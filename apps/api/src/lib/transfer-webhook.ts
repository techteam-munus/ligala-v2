import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";

export type PayoutWebhookStatus = "succeeded" | "failed" | "returned";

export function mapTransferStatus(raw: string): PayoutWebhookStatus | null {
  if (raw === "succeeded") return "succeeded";
  if (raw === "failed") return "failed";
  if (raw === "returned") return "returned";
  return null;
}

/**
 * Idempotent transfer reconciliation. Keyed on (provider, providerTransferId);
 * a replayed event for an already-terminal payout no-ops. On failed/returned,
 * re-credit the lawyer's balance so funds are never lost.
 */
export async function applyTransferWebhook(input: {
  provider: "paymongo" | "dev_simulate";
  providerTransferId: string;
  status: PayoutWebhookStatus;
  failureReason?: string;
}) {
  const conn = db();
  const payout = await conn.query.payouts.findFirst({
    where:
      input.provider === "dev_simulate"
        ? eq(schema.payouts.id, input.providerTransferId)
        : eq(schema.payouts.providerTransferId, input.providerTransferId),
  });
  if (!payout) throw new HTTPException(404, { message: "payout_not_found" });

  if (payout.status === "succeeded" || payout.status === "failed" || payout.status === "returned") {
    return { idempotent: true, payoutId: payout.id, status: payout.status };
  }

  const now = new Date();
  await conn
    .update(schema.payouts)
    .set({
      status: input.status,
      failureReason: input.failureReason ?? null,
      completedAt: input.status === "succeeded" ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.payouts.id, payout.id));

  if (input.status === "failed" || input.status === "returned") {
    await conn.insert(schema.balanceEntries).values([
      {
        id: crypto.randomUUID(),
        lawyerId: payout.lawyerId,
        kind: "adjustment",
        direction: "credit",
        amountCents: payout.netCents,
        currency: payout.currency,
        clearsAt: now,
        relatedPayoutId: payout.id,
        note: `Re-credit ${input.status} payout ${payout.id}`,
      },
      {
        id: crypto.randomUUID(),
        lawyerId: payout.lawyerId,
        kind: "adjustment",
        direction: "credit",
        amountCents: payout.feeCents,
        currency: payout.currency,
        clearsAt: now,
        relatedPayoutId: payout.id,
        note: `Re-credit payout fee ${payout.id}`,
      },
    ]);
  }

  return { idempotent: false, payoutId: payout.id, status: input.status };
}

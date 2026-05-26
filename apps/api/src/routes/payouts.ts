import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { payoutMethodInput, withdrawalInput } from "@ligala/shared/schemas";
import { requireRole } from "../middleware/session";
import {
  PAYOUT_FEE_CENTS,
  checkWithdrawable,
  computeBalance,
  type LedgerLine,
} from "../lib/payouts";
import { env } from "../lib/env";
import {
  createBatchTransfer,
  PaymongoApiError,
  PaymongoUnreachableError,
} from "../lib/paymongo";
import { applyTransferWebhook } from "../lib/transfer-webhook";

function newId() {
  return crypto.randomUUID();
}

/** Stable advisory-lock key per lawyer (FNV-1a -> signed 32-bit int). */
function lawyerLockKey(lawyerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < lawyerId.length; i++) {
    h ^= lawyerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** True iff the lawyer's most-recent KYC submission is approved. */
async function isKycApproved(lawyerId: string): Promise<boolean> {
  const latest = await db().query.kycSubmissions.findFirst({
    where: eq(schema.kycSubmissions.lawyerId, lawyerId),
    orderBy: desc(schema.kycSubmissions.createdAt),
  });
  return latest?.status === "approved";
}

async function loadLedgerLines(lawyerId: string): Promise<LedgerLine[]> {
  const rows = await db()
    .select({
      direction: schema.balanceEntries.direction,
      amountCents: schema.balanceEntries.amountCents,
      clearsAt: schema.balanceEntries.clearsAt,
    })
    .from(schema.balanceEntries)
    .where(eq(schema.balanceEntries.lawyerId, lawyerId));
  return rows.map((r) => ({
    direction: r.direction,
    amountCents: Number(r.amountCents),
    clearsAt: r.clearsAt,
  }));
}

export const payouts = new Hono()
  .use("*", requireRole("lawyer"))

  .get("/balance", async (c) => {
    const user = c.get("user");
    const lines = await loadLedgerLines(user.id);
    const { availableCents, pendingCents } = computeBalance(lines, new Date());
    return c.json({ availableCents, pendingCents, currency: "PHP" });
  })

  .get("/ledger", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.balanceEntries)
      .where(eq(schema.balanceEntries.lawyerId, user.id))
      .orderBy(desc(schema.balanceEntries.createdAt))
      .limit(200);
    return c.json({ items: rows });
  })

  .get("/methods", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.lawyerPayoutMethods)
      .where(eq(schema.lawyerPayoutMethods.lawyerId, user.id))
      .orderBy(desc(schema.lawyerPayoutMethods.createdAt));
    return c.json({ items: rows });
  })

  .post("/methods", zValidator("json", payoutMethodInput), async (c) => {
    const user = c.get("user");
    if (!(await isKycApproved(user.id))) {
      throw new HTTPException(403, { message: "kyc_not_approved" });
    }
    const input = c.req.valid("json");
    const [row] = await db()
      .insert(schema.lawyerPayoutMethods)
      .values({
        id: newId(),
        lawyerId: user.id,
        type: input.type,
        accountNumber: input.accountNumber,
        accountHolderName: input.accountHolderName,
        bankBic: input.bankBic ?? null,
        isDefault: input.isDefault ?? false,
      })
      .returning();
    return c.json({ method: row }, 201);
  })

  .delete("/methods/:id", async (c) => {
    const user = c.get("user");
    const method = await db().query.lawyerPayoutMethods.findFirst({
      where: eq(schema.lawyerPayoutMethods.id, c.req.param("id")),
    });
    if (!method || method.lawyerId !== user.id) {
      throw new HTTPException(404, { message: "method_not_found" });
    }
    await db()
      .delete(schema.lawyerPayoutMethods)
      .where(eq(schema.lawyerPayoutMethods.id, method.id));
    return c.json({ ok: true });
  })

  .get("/", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.lawyerId, user.id))
      .orderBy(desc(schema.payouts.createdAt));
    return c.json({ items: rows });
  })

  .post("/", zValidator("json", withdrawalInput), async (c) => {
    const user = c.get("user");
    if (!(await isKycApproved(user.id))) {
      throw new HTTPException(403, { message: "kyc_not_approved" });
    }
    const input = c.req.valid("json");
    const conn = db();

    const method = await conn.query.lawyerPayoutMethods.findFirst({
      where: eq(schema.lawyerPayoutMethods.id, input.payoutMethodId),
    });
    if (!method || method.lawyerId !== user.id) {
      throw new HTTPException(404, { message: "method_not_found" });
    }

    // Refuse real withdrawals when no disbursement wallet is configured in
    // production. Without this, the provider below resolves to `dev_simulate`,
    // which debits the ledger and creates a payout that can never settle (the
    // simulate endpoint 404s in prod) — silently draining the balance into a
    // stuck `pending` payout. Fail fast before any ledger write. Non-prod
    // (dev/test) intentionally keeps the dev_simulate path for local smoke tests.
    if (env().NODE_ENV === "production" && !env().PAYMONGO_WALLET_ACCOUNT_NUMBER) {
      throw new HTTPException(501, { message: "payouts_not_configured" });
    }

    // If configured for real disbursement (wallet account set) the secret key
    // must also be present — fail fast (501) before debiting the ledger.
    if (env().PAYMONGO_WALLET_ACCOUNT_NUMBER && !env().PAYMONGO_SECRET_KEY) {
      throw new HTTPException(501, { message: "paymongo_not_configured" });
    }

    const payoutRow = await conn.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${lawyerLockKey(user.id)})`);

      const rows = await tx
        .select({
          direction: schema.balanceEntries.direction,
          amountCents: schema.balanceEntries.amountCents,
          clearsAt: schema.balanceEntries.clearsAt,
        })
        .from(schema.balanceEntries)
        .where(eq(schema.balanceEntries.lawyerId, user.id));
      const lines: LedgerLine[] = rows.map((r) => ({
        direction: r.direction,
        amountCents: Number(r.amountCents),
        clearsAt: r.clearsAt,
      }));
      const { availableCents } = computeBalance(lines, new Date());

      const check = checkWithdrawable({
        requestCents: input.amountCents,
        availableCents,
        minCents: env().PAYOUT_MIN_CENTS,
      });
      if (!check.ok) throw new HTTPException(409, { message: check.error });

      const provider = env().PAYMONGO_WALLET_ACCOUNT_NUMBER ? "paymongo" : "dev_simulate";
      const netCents = input.amountCents - PAYOUT_FEE_CENTS;
      if (netCents <= 0) throw new HTTPException(409, { message: "amount_below_minimum" });

      const id = newId();
      const now = new Date();
      const [created] = await tx
        .insert(schema.payouts)
        .values({
          id,
          lawyerId: user.id,
          payoutMethodId: method.id,
          amountCents: input.amountCents,
          feeCents: PAYOUT_FEE_CENTS,
          netCents,
          currency: "PHP",
          provider,
          status: "pending",
          destinationSnapshot: {
            type: method.type,
            accountNumber: method.accountNumber,
            accountHolderName: method.accountHolderName,
            bankBic: method.bankBic,
          },
        })
        .returning();

      await tx.insert(schema.balanceEntries).values([
        {
          id: newId(),
          lawyerId: user.id,
          kind: "payout",
          direction: "debit",
          amountCents: netCents,
          currency: "PHP",
          clearsAt: now,
          relatedPayoutId: id,
          note: `Withdrawal ${id}`,
        },
        {
          id: newId(),
          lawyerId: user.id,
          kind: "payout_fee",
          direction: "debit",
          amountCents: PAYOUT_FEE_CENTS,
          currency: "PHP",
          clearsAt: now,
          relatedPayoutId: id,
          note: `Payout fee ${id}`,
        },
      ]);

      return created!;
    });

    if (payoutRow.provider === "dev_simulate") {
      return c.json({ payout: payoutRow }, 201);
    }

    const e = env();
    const rail: "instapay" | "pesonet" = method.type === "bank" ? "pesonet" : "instapay";
    try {
      const { transferId } = await createBatchTransfer({
        secretKey: e.PAYMONGO_SECRET_KEY ?? "",
        amountCents: payoutRow.netCents,
        currency: "PHP",
        provider: rail,
        sourceAccount: {
          number: e.PAYMONGO_WALLET_ACCOUNT_NUMBER ?? "",
          name: e.PAYMONGO_WALLET_ACCOUNT_NAME,
          bic: e.PAYMONGO_WALLET_BIC ?? undefined,
        },
        destination: {
          number: method.accountNumber,
          name: method.accountHolderName,
          bic: method.bankBic ?? undefined,
        },
        referenceNumber: payoutRow.id,
        callbackUrl: `${e.BETTER_AUTH_URL}/webhooks/paymongo-transfer`,
        idempotencyKey: payoutRow.id,
      });
      await conn
        .update(schema.payouts)
        .set({ providerTransferId: transferId, status: "processing", updatedAt: new Date() })
        .where(eq(schema.payouts.id, payoutRow.id));
      return c.json({ payout: { ...payoutRow, providerTransferId: transferId, status: "processing" } }, 201);
    } catch (err) {
      const failCode =
        err instanceof PaymongoApiError
          ? "paymongo_request_failed"
          : err instanceof PaymongoUnreachableError
            ? "paymongo_unreachable"
            : "disbursement_request_failed";
      await conn
        .update(schema.payouts)
        .set({ status: "failed", failureReason: failCode, updatedAt: new Date() })
        .where(eq(schema.payouts.id, payoutRow.id));
      await conn.insert(schema.balanceEntries).values([
        {
          id: newId(), lawyerId: user.id, kind: "adjustment", direction: "credit",
          amountCents: payoutRow.netCents, currency: "PHP", clearsAt: new Date(),
          relatedPayoutId: payoutRow.id, note: `Re-credit failed payout ${payoutRow.id}`,
        },
        {
          id: newId(), lawyerId: user.id, kind: "adjustment", direction: "credit",
          amountCents: PAYOUT_FEE_CENTS, currency: "PHP", clearsAt: new Date(),
          relatedPayoutId: payoutRow.id, note: `Re-credit payout fee ${payoutRow.id}`,
        },
      ]);
      if (err instanceof PaymongoApiError) {
        console.error("paymongo_transfer_failed", err.status, err.bodyText.slice(0, 200));
        throw new HTTPException(502, { message: failCode });
      }
      if (err instanceof PaymongoUnreachableError) {
        console.error("paymongo_transfer_unreachable", err.cause);
        throw new HTTPException(502, { message: failCode });
      }
      throw err;
    }
  });

/** Mirrors the `payout_status` pgEnum — used to validate the admin ?status= filter. */
const PAYOUT_STATUS_VALUES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "returned",
] as const;
type PayoutStatusValue = (typeof PAYOUT_STATUS_VALUES)[number];

/**
 * Admin payout queue (read-only). Mounted at /admin/payouts.
 */
export const adminPayouts = new Hono()
  .use("*", requireRole("admin"))
  .get("/", async (c) => {
    // Validate the optional ?status= filter against the payout_status enum
    // before it reaches the query. A raw unknown value would otherwise be sent
    // to Postgres and rejected ("invalid input value for enum payout_status"),
    // surfacing as a 500 rather than a filtered/empty result. Unknown → ignore.
    const statusParam = c.req.query("status");
    const status = PAYOUT_STATUS_VALUES.includes(statusParam as PayoutStatusValue)
      ? (statusParam as PayoutStatusValue)
      : undefined;
    const conn = db();
    const base = conn
      .select({
        payout: schema.payouts,
        lawyerName: schema.user.name,
        lawyerEmail: schema.user.email,
      })
      .from(schema.payouts)
      .leftJoin(schema.user, eq(schema.user.id, schema.payouts.lawyerId));
    const rows = status
      ? await base
          .where(eq(schema.payouts.status, status))
          .orderBy(desc(schema.payouts.createdAt))
      : await base.orderBy(desc(schema.payouts.createdAt));
    return c.json({
      items: rows.map((r) => ({
        ...r.payout,
        lawyer: r.lawyerName ? { name: r.lawyerName, email: r.lawyerEmail } : null,
      })),
    });
  });

/**
 * Dev-only payout simulator. Flips a `dev_simulate` payout to succeeded/failed.
 * Session-less (mounted outside `payouts`' requireRole), mirroring billingDev.
 */
export const payoutsDev = new Hono().post("/simulate-transfer", async (c) => {
  if (env().NODE_ENV === "production") {
    throw new HTTPException(404, { message: "not_found" });
  }
  const url = new URL(c.req.url);
  const payoutId = url.searchParams.get("payoutId");
  const status = url.searchParams.get("status") === "failed" ? "failed" : "succeeded";
  if (!payoutId) throw new HTTPException(400, { message: "missing_params" });
  const result = await applyTransferWebhook({
    provider: "dev_simulate",
    providerTransferId: payoutId, // for dev_simulate, applyTransferWebhook looks up by payout.id
    status,
  });
  return c.json(result);
});

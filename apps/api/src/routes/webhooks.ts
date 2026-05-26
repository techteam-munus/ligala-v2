import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { idmetaWebhookPayload, paymentWebhookInput } from "@ligala/shared/schemas";
import { applyPaymentWebhook } from "./billing";
import {
  verifyWebhookSignature,
  type PaymongoEvent,
} from "../lib/paymongo";
import { env } from "../lib/env";
import { applyTransferWebhook, mapTransferStatus } from "../lib/transfer-webhook";

/**
 * Webhook handlers. Real deployments verify signatures and enqueue to SQS;
 * for dev we process inline so the flow is observable end-to-end locally.
 * The worker dispatchers in `workers/` will reuse the same handlers via the
 * shared `applyPaymentWebhook` helper.
 *
 * PayMongo + PayPal both normalize to `paymentWebhookInput` here — the real
 * routes will translate from each provider's payload shape into this
 * common form before calling `applyPaymentWebhook`.
 */
export const webhooks = new Hono()
  .post("/idmeta", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = idmetaWebhookPayload.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "bad_payload", issues: parsed.error.flatten() }, 400);
    }
    const { applicant_id, status, reject_reason } = parsed.data;

    const submission =
      (await db().query.kycSubmissions.findFirst({
        where: eq(schema.kycSubmissions.idmetaApplicantId, applicant_id),
      })) ??
      (await db().query.kycSubmissions.findFirst({
        where: eq(schema.kycSubmissions.id, applicant_id),
      }));

    if (!submission) {
      return c.json({ error: "submission_not_found", applicant_id }, 404);
    }

    const next =
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : "submitted";

    await db()
      .update(schema.kycSubmissions)
      .set({
        status: next,
        idmetaApplicantId: applicant_id,
        decidedAt: next === "submitted" ? null : new Date(),
        rejectReason: next === "rejected" ? reject_reason ?? null : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.kycSubmissions.id, submission.id));

    return c.json({ ok: true, submissionId: submission.id, status: next });
  })

  /**
   * PayMongo webhook. Reads the raw body for HMAC verification, then translates
   * `checkout_session.payment.paid` / `payment.paid` / `payment.failed` into the
   * normalized `applyPaymentWebhook` shape. Any other event type is acknowledged
   * (200) but not processed, so PayMongo doesn't retry events we don't care
   * about. Unknown invoiceId is also 200-acknowledged (with an error log) to
   * avoid a permanent retry loop on a misconfigured metadata field.
   */
  .post("/paymongo", async (c) => {
    const secret = env().PAYMONGO_WEBHOOK_SECRET;
    if (!secret) {
      return c.json({ error: "paymongo_webhook_not_configured" }, 501);
    }
    const raw = await c.req.raw.text();
    const header = c.req.header("Paymongo-Signature");

    let event: PaymongoEvent;
    try {
      event = verifyWebhookSignature(raw, header, secret);
    } catch (err) {
      console.warn("paymongo_webhook_signature_invalid", err);
      return c.json({ error: "invalid_signature" }, 401);
    }

    const type = event.data.attributes.type;
    // We deliberately do NOT handle `payment.paid` here even though we're
    // subscribed to it: for hosted-checkout flows PayMongo also fires
    // `checkout_session.payment.paid` with the same logical payment but a
    // different resource id (cs_xxx vs pay_xxx), so dedup misses it and we
    // end up writing a second payment row + double-extending the period.
    // `checkout_session.payment.paid` is the authoritative event for our
    // flow — it carries `total_amount` and our `metadata.invoiceId`.
    if (
      type !== "checkout_session.payment.paid" &&
      type !== "payment.failed"
    ) {
      return c.json({ ignored: true, type });
    }

    const resource = event.data.attributes.data;
    const metadata = resource.attributes.metadata ?? {};
    const invoiceId = metadata.invoiceId;
    if (!invoiceId) {
      console.error("paymongo_webhook_missing_invoice_id", { type, resourceId: resource.id });
      return c.json({ ignored: true, reason: "no_invoice_id" });
    }

    const providerPaymentId = resource.id;
    // Pass undefined (not 0) when PayMongo's event lacks both amount fields,
    // so applyPaymentWebhook falls back to invoice.totalCents - invoice.paidCents
    // instead of writing a zero-amount payment row.
    const amountCents: number | undefined =
      typeof resource.attributes.total_amount === "number"
        ? resource.attributes.total_amount
        : typeof resource.attributes.amount === "number"
          ? resource.attributes.amount
          : undefined;
    // Collection fee PayMongo charged on this payment — forwarded so the lawyer
    // balance credit nets it out. NOTE: exact field name unconfirmed in sandbox;
    // when absent we pass undefined → fee treated as 0 (no deduction yet).
    const feeCents: number | undefined =
      typeof resource.attributes.fee === "number" ? resource.attributes.fee : undefined;
    const status: "succeeded" | "failed" =
      type === "payment.failed" ? "failed" : "succeeded";
    const failureReason =
      type === "payment.failed"
        ? resource.attributes.last_payment_error?.message
        : undefined;

    let result: Awaited<ReturnType<typeof applyPaymentWebhook>>;
    try {
      result = await applyPaymentWebhook({
        provider: "paymongo",
        providerPaymentId,
        invoiceId,
        status,
        amountCents,
        feeCents,
        currency: "PHP",
        failureReason,
        rawPayload: event,
      });
    } catch (err) {
      if (err instanceof HTTPException && err.status === 404) {
        // Invoice referenced by metadata.invoiceId doesn't exist in DB.
        // Acknowledge with 200 so PayMongo stops retrying; loud-log so we
        // notice if this happens (it shouldn't — our code sets the metadata).
        console.error("paymongo_webhook_invoice_not_found", {
          invoiceId,
          providerPaymentId,
        });
        return c.json({ ignored: true, reason: "invoice_not_found" });
      }
      throw err;
    }
    if (result.idempotent) {
      console.info("paymongo_webhook_replay", {
        providerPaymentId,
        paymentId: result.paymentId,
      });
    }
    return c.json(result);
  })

  /**
   * PayPal webhook. Same story as PayMongo: dev accepts normalized payload,
   * production translates PayPal's `event_type=PAYMENT.CAPTURE.COMPLETED`
   * resource ids before calling applyPaymentWebhook.
   */
  .post("/paypal", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = paymentWebhookInput.safeParse({ ...body, provider: "paypal" });
    if (!parsed.success) {
      return c.json({ error: "bad_payload", issues: parsed.error.flatten() }, 400);
    }
    const r = await applyPaymentWebhook({ ...parsed.data, rawPayload: body });
    return c.json(r);
  })

  /**
   * PayMongo transfer webhook. Reconciles payout rows when a batch_transfer
   * settles (succeeded) or bounces (failed / returned). Idempotent: replayed
   * events for already-terminal payouts are no-op'd with { idempotent: true }.
   * On failed/returned the lawyer's net + fee are re-credited so funds are
   * never lost.
   */
  .post("/paymongo-transfer", async (c) => {
    // Sandbox gate: confirm PayMongo's transfer webhook signature scheme + status shape.
    // We reuse the same HMAC verifier as /paymongo.
    const secret = env().PAYMONGO_TRANSFER_WEBHOOK_SECRET ?? env().PAYMONGO_WEBHOOK_SECRET;
    if (!secret) return c.json({ error: "transfer_webhook_not_configured" }, 501);
    const raw = await c.req.raw.text();
    const header = c.req.header("Paymongo-Signature");
    let event: PaymongoEvent;
    try {
      event = verifyWebhookSignature(raw, header, secret);
    } catch (err) {
      console.warn("paymongo_transfer_signature_invalid", err);
      return c.json({ error: "invalid_signature" }, 401);
    }
    const resource = event.data.attributes.data;
    const providerTransferId = resource.id;
    const rawStatus =
      typeof resource.attributes.status === "string" ? resource.attributes.status : "";
    const status = mapTransferStatus(rawStatus);
    if (!status) return c.json({ ignored: true, status: rawStatus });
    try {
      const result = await applyTransferWebhook({
        provider: "paymongo",
        providerTransferId,
        status,
        failureReason:
          typeof resource.attributes.last_payment_error?.message === "string"
            ? resource.attributes.last_payment_error.message
            : undefined,
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof HTTPException && err.status === 404) {
        console.error("paymongo_transfer_payout_not_found", { providerTransferId });
        return c.json({ ignored: true, reason: "payout_not_found" });
      }
      throw err;
    }
  });

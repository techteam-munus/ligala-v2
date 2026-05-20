import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { idmetaWebhookPayload, paymentWebhookInput } from "@ligala/shared/schemas";
import { applyPaymentWebhook } from "./billing";

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
   * PayMongo webhook. Dev accepts a normalized payload (see paymentWebhookInput).
   * Production wiring will sign-verify the X-Paymongo-Signature header and
   * translate PayMongo's `data.attributes.data.attributes.payment_intent.id`
   * shape into the normalized form before calling applyPaymentWebhook.
   */
  .post("/paymongo", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = paymentWebhookInput.safeParse({ ...body, provider: "paymongo" });
    if (!parsed.success) {
      return c.json({ error: "bad_payload", issues: parsed.error.flatten() }, 400);
    }
    const r = await applyPaymentWebhook({ ...parsed.data, rawPayload: body });
    return c.json(r);
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
  });

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { idmetaWebhookPayload } from "@ligala/shared/schemas";

/**
 * Webhook handlers. Real deployments verify signatures and enqueue to SQS;
 * for Phase 2 we do the IDMeta processing inline so the flow is observable
 * end-to-end locally. The dispatcher in `workers/idmeta` does the same work
 * when SQS is wired up — keep the logic identical.
 */
export const webhooks = new Hono()
  .post("/idmeta", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = idmetaWebhookPayload.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "bad_payload", issues: parsed.error.flatten() }, 400);
    }
    const { applicant_id, status, reject_reason } = parsed.data;

    // Resolve the submission by IDMeta applicant id. Real IDMeta correlates by
    // applicant_id; this stub also accepts a submission id passed as applicant_id
    // for local testing.
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

  // Phase 5 wires these. Returning 501 keeps anyone testing in dev honest.
  .post("/paymongo", (c) => c.json({ error: "not_implemented", phase: 5 }, 501))
  .post("/paypal", (c) => c.json({ error: "not_implemented", phase: 5 }, 501));

import { z } from "zod";

export const kycDocumentKind = z.enum([
  "government_id",
  "bar_certificate",
  "selfie",
  "other",
]);
export type KycDocumentKind = z.infer<typeof kycDocumentKind>;

export const kycSubmissionInput = z.object({
  documents: z
    .array(
      z.object({
        kind: kycDocumentKind,
        // S3 object key from a prior /files/presign upload.
        s3Key: z.string().min(1).max(500),
      }),
    )
    .min(1, "at least one document is required")
    .max(10),
});

export type KycSubmissionInput = z.infer<typeof kycSubmissionInput>;

/**
 * IDMeta webhook payload — we model the *minimum* we need to act on. Real
 * IDMeta payloads carry more; the worker ignores unknown fields.
 */
export const idmetaWebhookPayload = z.object({
  applicant_id: z.string().min(1),
  status: z.enum(["approved", "rejected", "pending_review"]),
  reject_reason: z.string().optional().nullable(),
});

export type IdmetaWebhookPayload = z.infer<typeof idmetaWebhookPayload>;

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
 * IDMeta verification webhook. Confirmed shape (Postman collection): the
 * webhook delivers `id` (= the verification id), a string `status`, the
 * `metadata` we set at create time (echoed back), and `verification_results`
 * carrying the captured document/biometric data. We model the minimum and
 * keep everything else permissive — IDMeta may add fields, and the image
 * extraction scans `verification_results` structurally rather than by path.
 */
export const idmetaWebhookPayload = z
  .object({
    // Some IDMeta surfaces use `id`, others `verification_id`. Accept both,
    // normalize to `id`.
    id: z.string().min(1).optional(),
    verification_id: z.string().min(1).optional(),
    company_id: z.union([z.string(), z.number()]).optional(),
    template_id: z.union([z.string(), z.number()]).optional(),
    status: z.union([z.string(), z.number()]).optional(),
    status_message: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    profile_name: z.string().optional(),
    verification_results: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough()
  .transform((p) => ({ ...p, id: p.id ?? p.verification_id }))
  .refine((p) => typeof p.id === "string" && p.id.length > 0, {
    message: "missing verification id",
  });

export type IdmetaWebhookPayload = z.infer<typeof idmetaWebhookPayload>;

/** Response of POST /lawyers/kyc/idmeta/start — the URL the browser opens. */
export const idmetaStartResponse = z.object({
  hostedUrl: z.string().url(),
  submissionId: z.string().min(1),
});

export type IdmetaStartResponse = z.infer<typeof idmetaStartResponse>;

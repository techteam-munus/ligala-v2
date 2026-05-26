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

// NOTE: the IDMeta webhook payload is parsed by `normalizeIdmetaWebhook` in
// @ligala/kyc (the real shape is `{ type, data: {...} }` and varies per event
// type), so there is no shared Zod schema for it here.

/** Response of POST /lawyers/kyc/idmeta/start — the URL the browser opens. */
export const idmetaStartResponse = z.object({
  hostedUrl: z.string().url(),
  submissionId: z.string().min(1),
});

export type IdmetaStartResponse = z.infer<typeof idmetaStartResponse>;

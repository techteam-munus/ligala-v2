import { z } from "zod";

export const presignRequest = z.object({
  kind: z.enum([
    "kyc_document",
    "lawyer_photo",
    "office_photo",
    "case_attachment",
  ]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  byteSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export type PresignRequest = z.infer<typeof presignRequest>;

export const presignResponse = z.object({
  s3Key: z.string(),
  uploadUrl: z.url(),
  // Echoed for the client to remember which file this URL belongs to.
  kind: presignRequest.shape.kind,
  expiresAt: z.string(), // ISO timestamp
});

export type PresignResponse = z.infer<typeof presignResponse>;

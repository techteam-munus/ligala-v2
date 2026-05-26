import { z } from "zod";

export const presignRequest = z.object({
  kind: z.enum([
    "kyc_document",
    "lawyer_photo",
    "office_photo",
    "case_attachment",
    "avatar",
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

// Body for PATCH /accounts/avatar — the S3 key returned by a prior `avatar`
// presign. The api re-checks the key is owned by the caller before storing it
// on `user.image`.
export const avatarUpdateInput = z.object({
  s3Key: z.string().min(1),
});

export type AvatarUpdateInput = z.infer<typeof avatarUpdateInput>;

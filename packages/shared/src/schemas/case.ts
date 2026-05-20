import { z } from "zod";

export const caseTypeEnum = z.enum(["paid", "probono"]);
export type CaseTypeEnum = z.infer<typeof caseTypeEnum>;

export const caseStatusEnum = z.enum([
  "pending",
  "declined",
  "accepted",
  "active",
  "closed",
  "cancelled",
]);
export type CaseStatusEnum = z.infer<typeof caseStatusEnum>;

export const caseCreateInput = z.object({
  lawyerSlug: z.string().min(3).max(60),
  type: caseTypeEnum,
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(8000),
  practiceAreaId: z.string().max(64).optional().nullable(),
  jurisdictionId: z.string().max(64).optional().nullable(),
});
export type CaseCreateInput = z.infer<typeof caseCreateInput>;

export const caseDecisionInput = z.object({
  decision: z.enum(["accept", "decline"]),
  reason: z.string().max(1000).optional(),
});
export type CaseDecisionInput = z.infer<typeof caseDecisionInput>;

export const caseCloseInput = z.object({
  action: z.enum(["close", "cancel"]),
  reason: z.string().max(1000).optional(),
});
export type CaseCloseInput = z.infer<typeof caseCloseInput>;

export const caseNoteVisibilityEnum = z.enum(["shared", "lawyer", "client"]);
export const caseNoteInput = z.object({
  body: z.string().min(1).max(8000),
  visibility: caseNoteVisibilityEnum.default("shared"),
});
export type CaseNoteInput = z.infer<typeof caseNoteInput>;

export const caseAttachmentInput = z.object({
  s3Key: z.string().min(1).max(500),
  filename: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
});
export type CaseAttachmentInput = z.infer<typeof caseAttachmentInput>;

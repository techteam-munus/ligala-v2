import { z } from "zod";

export const referralKindEnum = z.enum(["case_referral", "link_signup"]);
export type ReferralKindEnum = z.infer<typeof referralKindEnum>;

export const referralStatusEnum = z.enum([
  "pending",
  "accepted",
  "declined",
  "completed",
]);
export type ReferralStatusEnum = z.infer<typeof referralStatusEnum>;

/**
 * Outbound case referral. The sender (a lawyer) picks the recipient by slug
 * and optionally attaches an existing case they're stepping away from. If
 * `caseId` is set, accepting the referral reassigns the case to the recipient.
 */
export const referralCreateInput = z.object({
  toLawyerSlug: z.string().min(3).max(60),
  caseId: z.string().uuid().optional().nullable(),
  noteMd: z.string().max(4000).optional(),
});
export type ReferralCreateInput = z.infer<typeof referralCreateInput>;

export const referralDecisionInput = z.object({
  decision: z.enum(["accept", "decline"]),
  reason: z.string().max(1000).optional(),
});
export type ReferralDecisionInput = z.infer<typeof referralDecisionInput>;

/**
 * Public-facing share token. Slug is normalized server-side to uppercase
 * alphanumeric — the user types the label, the server picks the slug.
 */
export const referralLinkInput = z.object({
  label: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(4)
    .max(40)
    .regex(/^[A-Z0-9]+$/, "uppercase letters and digits only")
    .optional(),
});
export type ReferralLinkInput = z.infer<typeof referralLinkInput>;

export const referralLinkPatch = z.object({
  active: z.boolean().optional(),
  label: z.string().min(1).max(120).optional(),
});
export type ReferralLinkPatch = z.infer<typeof referralLinkPatch>;

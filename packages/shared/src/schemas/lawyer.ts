import { z } from "zod";

// Slug — kebab-case, 3-60 chars. Used as the public lawyer URL segment.
export const lawyerSlug = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase letters, digits, hyphens (no leading/trailing hyphen)");

export const lawyerProfileInput = z.object({
  slug: lawyerSlug,
  barNumber: z.string().max(40).optional().nullable(),
  ibpChapterId: z.string().max(64).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  practiceAreaIds: z.array(z.string().max(64)).max(20).default([]),
  jurisdictionIds: z.array(z.string().max(64)).max(20).default([]),
});

export type LawyerProfileInput = z.infer<typeof lawyerProfileInput>;

export const lawyerProfilePatch = lawyerProfileInput.partial();
export type LawyerProfilePatch = z.infer<typeof lawyerProfilePatch>;

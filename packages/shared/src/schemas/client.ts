import { z } from "zod";

export const clientProfileInput = z.object({
  displayName: z.string().min(1).max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  preferredLanguage: z.string().min(2).max(8).default("en"),
});

export type ClientProfileInput = z.infer<typeof clientProfileInput>;

export const clientProfilePatch = clientProfileInput.partial();
export type ClientProfilePatch = z.infer<typeof clientProfilePatch>;

import { z } from "zod";

export const officeInput = z.object({
  name: z.string().min(2).max(120),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().length(2).default("PH"),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.email().max(160).optional().nullable(),
  website: z.url().max(200).optional().nullable(),
});

export type OfficeInput = z.infer<typeof officeInput>;
export const officePatch = officeInput.partial();
export type OfficePatch = z.infer<typeof officePatch>;

// HH:MM (24-hour). `null` means unset for that side of the window.
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM (24-hour)")
  .nullable();

export const officeScheduleEntry = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeOfDay,
    closesAt: timeOfDay,
    isClosed: z.boolean().default(false),
  })
  .refine(
    (entry) =>
      entry.isClosed ||
      entry.opensAt === null ||
      entry.closesAt === null ||
      entry.opensAt < entry.closesAt,
    "opensAt must be earlier than closesAt",
  );

export const officeScheduleInput = z.object({
  entries: z.array(officeScheduleEntry).max(7),
});

export type OfficeScheduleInput = z.infer<typeof officeScheduleInput>;

export const officeFaqInput = z.object({
  question: z.string().min(3).max(300),
  answer: z.string().min(1).max(2000),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export type OfficeFaqInput = z.infer<typeof officeFaqInput>;

import { z } from "zod";

/**
 * Public lawyer-directory search. All filters are optional; an empty query
 * returns the verified-lawyer feed, ranked by recency.
 */
export const lawyerSearchQuery = z.object({
  q: z.string().max(120).optional(),
  practiceAreaId: z.string().max(64).optional(),
  jurisdictionId: z.string().max(64).optional(),
  city: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type LawyerSearchQuery = z.infer<typeof lawyerSearchQuery>;

export const lawyerSearchResultItem = z.object({
  slug: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  verified: z.boolean(),
  practiceAreas: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type LawyerSearchResultItem = z.infer<typeof lawyerSearchResultItem>;

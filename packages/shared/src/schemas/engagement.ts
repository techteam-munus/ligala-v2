import { z } from "zod";

export const engagementRateTypeEnum = z.enum(["hourly", "flat", "contingency"]);

/**
 * Exactly one of hourlyCents / flatCents / contingencyBps must be set,
 * matching `rateType`. Bps = basis points (1% = 100bps).
 */
export const engagementInput = z
  .object({
    rateType: engagementRateTypeEnum,
    hourlyCents: z.number().int().min(0).max(1_000_000).optional().nullable(),
    flatCents: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
    contingencyBps: z.number().int().min(0).max(10_000).optional().nullable(),
    termsMd: z.string().min(10).max(20_000),
  })
  .refine(
    (e) =>
      (e.rateType === "hourly" && e.hourlyCents != null) ||
      (e.rateType === "flat" && e.flatCents != null) ||
      (e.rateType === "contingency" && e.contingencyBps != null),
    "rate amount must match rateType",
  );
export type EngagementInput = z.infer<typeof engagementInput>;

export const engagementDecisionInput = z.object({
  decision: z.enum(["sign", "decline"]),
  reason: z.string().max(1000).optional(),
});
export type EngagementDecisionInput = z.infer<typeof engagementDecisionInput>;

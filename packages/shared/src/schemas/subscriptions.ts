import { z } from "zod";

export const subscriptionStatus = z.enum(["trialing", "active", "past_due"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatus>;

/**
 * Returned by GET /lawyer/subscription. `daysRemaining` is computed server-side
 * from `currentPeriodEndsAt` so the client doesn't have to reason about clock
 * skew or timezones; it is floored to whole days (negative when expired).
 */
export const lawyerSubscriptionDto = z.object({
  lawyerId: z.string(),
  status: subscriptionStatus,
  trialEndsAt: z.iso.datetime({ offset: true }),
  currentPeriodEndsAt: z.iso.datetime({ offset: true }),
  lastPaidAt: z.iso.datetime({ offset: true }).nullable(),
  priceCents: z.number().int().min(0),
  daysRemaining: z.number().int(),
});
export type LawyerSubscriptionDto = z.infer<typeof lawyerSubscriptionDto>;

export const subscriptionCheckoutInput = z.object({
  provider: z.enum(["paymongo", "paypal", "dev_simulate"]),
  discountCode: z.string().trim().min(1).max(64).optional(),
});
export type SubscriptionCheckoutInput = z.infer<
  typeof subscriptionCheckoutInput
>;

export const subscriptionDiscountPreviewInput = z.object({
  code: z.string().trim().min(1).max(64),
});
export type SubscriptionDiscountPreviewInput = z.infer<
  typeof subscriptionDiscountPreviewInput
>;

export const subscriptionDiscountPreviewDto = z.object({
  code: z.string(),
  kind: z.enum(["percent", "fixed"]),
  discountCents: z.number().int().min(0),
  originalCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
});
export type SubscriptionDiscountPreviewDto = z.infer<
  typeof subscriptionDiscountPreviewDto
>;

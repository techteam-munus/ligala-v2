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
});
export type SubscriptionCheckoutInput = z.infer<
  typeof subscriptionCheckoutInput
>;

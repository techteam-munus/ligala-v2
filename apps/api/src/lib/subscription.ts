/**
 * Constants for the lawyer subscription plan. Kept here so signup
 * (trial bootstrap), the renewal route, and the webhook extension all agree.
 *
 * `SUBSCRIPTION_PRICE_CENTS` is the price NEW lawyers see; existing
 * subscriptions snapshot their own `priceCents` at signup so a future
 * price change doesn't retroactively re-bill anyone.
 */
export const TRIAL_DAYS = 30;
export const RENEWAL_DAYS = 30;
export const SUBSCRIPTION_PRICE_CENTS = 99_900;
export const SUBSCRIPTION_LINE_DESCRIPTION = "Ligala — Monthly subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Floored difference in whole days. Negative when `target` is in the past.
 * Used to render "X days left in trial" without leaking timezone math to
 * the client.
 */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.floor((target.getTime() - now.getTime()) / DAY_MS);
}

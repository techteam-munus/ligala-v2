import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Lawyer subscription state. One row per lawyer, inserted at promote-to-lawyer
 * time (claimIbpAndPromote) with a 30-day trial. `currentPeriodEndsAt` is the
 * source of truth for access — when it falls into the past, write endpoints
 * 403 with `subscription_expired` (see assertLawyerSubscription).
 *
 *   trialing  - first 30 days after signup (never paid)
 *   active    - paid at least once and currentPeriodEndsAt is in the future
 *   past_due  - paid before but current period has elapsed
 *
 * `priceCents` is snapshotted so a future price change doesn't retroactively
 * affect existing lawyers' renewals.
 */
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
]);

export const lawyerSubscriptions = pgTable("lawyer_subscription", {
  lawyerId: text("lawyer_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  status: subscriptionStatus("status").default("trialing").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
  currentPeriodEndsAt: timestamp("current_period_ends_at", {
    withTimezone: true,
  }).notNull(),
  lastPaidAt: timestamp("last_paid_at", { withTimezone: true }),
  priceCents: integer("price_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type LawyerSubscription = typeof lawyerSubscriptions.$inferSelect;
export type NewLawyerSubscription = typeof lawyerSubscriptions.$inferInsert;

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cases } from "./cases";

/**
 * Two flavors of referral exist in the system:
 *
 *   case_referral — Lawyer A has an existing case (or knows of one) that
 *                   would be better served by Lawyer B (different practice
 *                   area, conflict of interest, capacity). A creates an
 *                   outbound referral pointing at B; B accepts or declines.
 *                   On accept, the case is reassigned to B and a `referred`
 *                   activity row is written.
 *
 *   link_signup   — Lawyer A publishes a referral link (e.g. on social).
 *                   When a client creates a case via that link, the resulting
 *                   case carries `referralId` so the referring lawyer can
 *                   see attribution. The "fromLawyerId" is A; the
 *                   "toLawyerId" is the lawyer the client picked.
 */
export const referralKind = pgEnum("referral_kind", [
  "case_referral",
  "link_signup",
]);

export const referralStatus = pgEnum("referral_status", [
  "pending",
  "accepted",
  "declined",
  "completed",
]);

export const referrals = pgTable("referral", {
  id: text("id").primaryKey(),
  kind: referralKind("kind").notNull(),
  fromLawyerId: text("from_lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  toLawyerId: text("to_lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  caseId: text("case_id").references(() => cases.id, { onDelete: "set null" }),
  linkId: text("link_id").references(() => referralLinks.id, {
    onDelete: "set null",
  }),
  status: referralStatus("status").default("pending").notNull(),
  noteMd: text("note_md"),
  payload: jsonb("payload"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * A lawyer-owned share code. The slug is the public token (case-insensitive,
 * stored upper-cased), used in URLs like `/cases/new?ref=ATTYJUAN24`.
 * `clicks` is incremented on landing (best-effort, not auth-required);
 * `signups` is incremented when a case is created via the link.
 */
export const referralLinks = pgTable(
  "referral_link",
  {
    id: text("id").primaryKey(),
    lawyerId: text("lawyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label"),
    active: boolean("active").default(true).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    signups: integer("signups").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    slugUnique: uniqueIndex("referral_link_slug_unique").on(t.slug),
  }),
);

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
export type ReferralLink = typeof referralLinks.$inferSelect;
export type NewReferralLink = typeof referralLinks.$inferInsert;

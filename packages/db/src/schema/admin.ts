import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Append-only log of every admin-only mutation. Used to answer "who
 * changed what and why" without parsing webhook history or app logs.
 *
 * `subjectType` is a discriminator string (e.g. "user", "kyc_submission",
 * "discount_code", "invoice", "referral") — keep it loose so new admin
 * actions don't need a migration for the type alone. `subjectId` is the
 * primary key of that aggregate.
 *
 * `payload` carries the change details (before/after, refund amount,
 * decision reason); the convention is per-`action` and documented at the
 * call site.
 */
export const adminAuditAction = pgEnum("admin_audit_action", [
  "user_status_changed",
  "user_role_changed",
  "kyc_decided",
  "kyc_force_approved",
  "discount_code_removed",
  "invoice_refunded",
  "invoice_voided",
  "referral_force_decided",
  "ibp_lawyer_added",
]);

export const adminAuditLog = pgTable("admin_audit_log", {
  id: text("id").primaryKey(),
  actorAdminId: text("actor_admin_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  action: adminAuditAction("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  payload: jsonb("payload"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;

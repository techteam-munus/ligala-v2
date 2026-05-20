import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { jurisdictions, practiceAreas } from "./reference";

/**
 * Cases unify v1's separate paid + pro bono tables. The discriminator is
 * `type` — every other field is shared. Pro bono cases skip the engagement
 * agreement step and transition directly from `accepted` to `active`.
 */
export const caseType = pgEnum("case_type", ["paid", "probono"]);

/**
 * Status lifecycle:
 *   pending   — client submitted to a lawyer; awaiting decision
 *   declined  — lawyer declined (terminal)
 *   accepted  — lawyer accepted; for paid cases, waiting on engagement sign
 *   active    — work in progress (auto on pro bono accept; or after sign)
 *   closed    — case completed (terminal)
 *   cancelled — client withdrew before active (terminal)
 */
export const caseStatus = pgEnum("case_status", [
  "pending",
  "declined",
  "accepted",
  "active",
  "closed",
  "cancelled",
]);

export const cases = pgTable("case", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  type: caseType("type").notNull(),
  status: caseStatus("status").default("pending").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  practiceAreaId: text("practice_area_id").references(() => practiceAreas.id, {
    onDelete: "set null",
  }),
  jurisdictionId: text("jurisdiction_id").references(() => jurisdictions.id, {
    onDelete: "set null",
  }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  declineReason: text("decline_reason"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closeReason: text("close_reason"),
  /**
   * Phase 6 attribution. `referralId` points at the `referral` row when a
   * case was created via a referral link OR reassigned via case_referral.
   * `probonoReason` is the client's eligibility statement on pro bono cases.
   *
   * Both columns are nullable; we use text references with no FK to the
   * `referral` table to avoid a circular cross-file dependency at schema
   * eval time. The API layer is the source of truth for joining the two.
   */
  referralId: text("referral_id"),
  probonoReason: text("probono_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Append-only audit log. Every state change writes a row so the timeline
 * shown to client + lawyer is reconstructable without parsing diffs.
 *
 * `payload` is intentionally untyped (jsonb) so each kind can carry whatever
 * context it needs — e.g. note id, attachment id, engagement id, close reason.
 */
export const caseActivityKind = pgEnum("case_activity_kind", [
  "created",
  "accepted",
  "declined",
  "engagement_sent",
  "engagement_signed",
  "engagement_declined",
  "activated",
  "note_added",
  "attachment_added",
  "closed",
  "cancelled",
  "referred",
  "referral_accepted",
  "referral_declined",
]);

export const caseActivities = pgTable("case_activity", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  kind: caseActivityKind("kind").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Notes are author-owned. Visibility controls who can read:
 *   shared  — both client and lawyer
 *   lawyer  — lawyer-only (work-product, strategy)
 *   client  — client-only (private reminders)
 */
export const caseNoteVisibility = pgEnum("case_note_visibility", [
  "shared",
  "lawyer",
  "client",
]);

export const caseNotes = pgTable("case_note", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  visibility: caseNoteVisibility("visibility").default("shared").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * S3-backed file references. The actual upload goes through /files/presign
 * (dev stub today) — only metadata + the S3 key land here.
 */
export const caseAttachments = pgTable("case_attachment", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  uploaderUserId: text("uploader_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  s3Key: text("s3_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Engagement = the signed agreement between client + lawyer for a paid case.
 * One per case (caseId is unique). Pro bono cases never get one.
 *
 * Rates: only one of hourlyCents / flatCents / contingencyBps is set, based
 * on rateType. Bps = basis points (1% = 100bps) — keeps math integer-safe.
 */
export const engagementRateType = pgEnum("engagement_rate_type", [
  "hourly",
  "flat",
  "contingency",
]);

export const engagementStatus = pgEnum("engagement_status", [
  "sent",
  "signed",
  "declined",
]);

export const engagements = pgTable("engagement", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .unique()
    .references(() => cases.id, { onDelete: "cascade" }),
  rateType: engagementRateType("rate_type").notNull(),
  hourlyCents: integer("hourly_cents"),
  flatCents: integer("flat_cents"),
  contingencyBps: integer("contingency_bps"),
  termsMd: text("terms_md").notNull(),
  status: engagementStatus("status").default("sent").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type CaseActivity = typeof caseActivities.$inferSelect;
export type CaseNote = typeof caseNotes.$inferSelect;
export type CaseAttachment = typeof caseAttachments.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;

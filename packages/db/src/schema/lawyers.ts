import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { ibpChapters, jurisdictions, practiceAreas } from "./reference";

/**
 * One profile row per user with role=lawyer. user_id is both PK and FK so the
 * relationship is 1:1 and removing the user cascades the profile.
 */
export const lawyerProfiles = pgTable(
  "lawyer_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    barNumber: text("bar_number"),
    ibpChapterId: text("ibp_chapter_id").references(() => ibpChapters.id, {
      onDelete: "set null",
    }),
    bio: text("bio"),
    profilePhotoS3Key: text("profile_photo_s3_key"),
    /**
     * Pro bono opt-in (Phase 6). When true the lawyer is willing to take
     * pro bono cases and surfaces in `/lawyers?probono=true`. The optional
     * `probonoStatement` is a short note shown on the public profile; the
     * optional `probonoCapActive` lets a lawyer cap concurrent pro bono
     * load (NULL = no cap).
     */
    probonoAvailable: boolean("probono_available").default(false).notNull(),
    probonoStatement: text("probono_statement"),
    probonoCapActive: integer("probono_cap_active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    slugUnique: uniqueIndex("lawyer_profile_slug_unique").on(t.slug),
  }),
);

export const lawyerPracticeAreas = pgTable(
  "lawyer_practice_area",
  {
    lawyerId: text("lawyer_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    practiceAreaId: text("practice_area_id")
      .notNull()
      .references(() => practiceAreas.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.lawyerId, t.practiceAreaId] }),
  }),
);

export const lawyerJurisdictions = pgTable(
  "lawyer_jurisdiction",
  {
    lawyerId: text("lawyer_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.lawyerId, t.jurisdictionId] }),
  }),
);

export type LawyerProfile = typeof lawyerProfiles.$inferSelect;
export type NewLawyerProfile = typeof lawyerProfiles.$inferInsert;

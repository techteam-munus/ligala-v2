import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * One row per user with role=client. user_id is both PK and FK so the
 * relationship is 1:1 and removing the user cascades the profile.
 *
 * Lightweight on purpose — auth.user already holds name/email/image. This
 * captures the bits a client needs in order to be reached by a lawyer they
 * engage (phone, city) and any UI preferences.
 */
export const clientProfiles = pgTable("client_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  phone: text("phone"),
  city: text("city"),
  region: text("region"),
  preferredLanguage: text("preferred_language").default("en").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type ClientProfile = typeof clientProfiles.$inferSelect;
export type NewClientProfile = typeof clientProfiles.$inferInsert;

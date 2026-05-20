import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";
import { lawyerProfiles } from "./lawyers";

/**
 * One office per lawyer at launch (lawyerId is unique). Multi-office support
 * arrives if/when a real firm asks for it.
 */
export const offices = pgTable("office", {
  id: text("id").primaryKey(),
  lawyerId: text("lawyer_id")
    .notNull()
    .unique()
    .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
  name: text("name").notNull(),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country").default("PH").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * One row per day of week (0=Sun..6=Sat). isClosed = whole-day closure.
 */
export const officeSchedules = pgTable(
  "office_schedule",
  {
    officeId: text("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    isClosed: boolean("is_closed").default(false).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.officeId, t.dayOfWeek] }),
  }),
);

export const officeFaqs = pgTable("office_faq", {
  id: text("id").primaryKey(),
  officeId: text("office_id")
    .notNull()
    .references(() => offices.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export type Office = typeof offices.$inferSelect;
export type NewOffice = typeof offices.$inferInsert;
export type OfficeSchedule = typeof officeSchedules.$inferSelect;
export type OfficeFaq = typeof officeFaqs.$inferSelect;

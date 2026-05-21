import { date, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Directory of IBP-registered (Roll of Attorneys) lawyers. Maintained by
 * admins via the admin portal — independent of the `user` table at first;
 * once a lawyer completes signup with a matching record, `userId` links
 * the two. `rollNumber` is the Supreme Court roll number (unique per
 * lawyer). The unique index on `user_id` enforces that one IBP record
 * maps to at most one user account; Postgres treats multiple NULLs as
 * distinct so unclaimed rows coexist freely.
 */
export const ibpLawyers = pgTable(
  "ibp_lawyer",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    address: text("address").notNull(),
    rollSigned: date("roll_signed").notNull(),
    rollNumber: text("roll_number").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    rollNumberUnique: uniqueIndex("ibp_lawyer_roll_number_unique").on(t.rollNumber),
    userIdUnique: uniqueIndex("ibp_lawyer_user_id_unique").on(t.userId),
  }),
);

export type IbpLawyer = typeof ibpLawyers.$inferSelect;
export type NewIbpLawyer = typeof ibpLawyers.$inferInsert;

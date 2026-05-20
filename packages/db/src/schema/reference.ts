import { integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Reference data — read-mostly, seeded via migration. New rows go in via a
 * migration so the active set is reproducible across environments.
 */

export const ibpChapters = pgTable(
  "ibp_chapter",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    region: text("region").notNull(),
    city: text("city"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => ({
    nameUnique: uniqueIndex("ibp_chapter_name_unique").on(t.name),
  }),
);

export const practiceAreas = pgTable(
  "practice_area",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => ({
    nameUnique: uniqueIndex("practice_area_name_unique").on(t.name),
  }),
);

export const jurisdictions = pgTable(
  "jurisdiction",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    level: text("level").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => ({
    nameUnique: uniqueIndex("jurisdiction_name_unique").on(t.name),
  }),
);

export type IbpChapter = typeof ibpChapters.$inferSelect;
export type PracticeArea = typeof practiceAreas.$inferSelect;
export type Jurisdiction = typeof jurisdictions.$inferSelect;

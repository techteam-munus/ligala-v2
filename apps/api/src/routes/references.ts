import { Hono } from "hono";
import { asc } from "drizzle-orm";
import { db, schema } from "@ligala/db";

/**
 * Read-only reference data. Public — no auth required so unauthenticated
 * lawyer signup pages can render filter dropdowns.
 */
export const references = new Hono()
  .get("/ibp-chapters", async (c) => {
    const rows = await db().select().from(schema.ibpChapters).orderBy(asc(schema.ibpChapters.sortOrder), asc(schema.ibpChapters.name));
    return c.json({ items: rows });
  })
  .get("/practice-areas", async (c) => {
    const rows = await db().select().from(schema.practiceAreas).orderBy(asc(schema.practiceAreas.sortOrder), asc(schema.practiceAreas.name));
    return c.json({ items: rows });
  })
  .get("/jurisdictions", async (c) => {
    const rows = await db().select().from(schema.jurisdictions).orderBy(asc(schema.jurisdictions.sortOrder), asc(schema.jurisdictions.name));
    return c.json({ items: rows });
  });

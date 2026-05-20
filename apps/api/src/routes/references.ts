import { Hono } from "hono";

// Phase 2: IBP chapters, practice areas, jurisdictions (read-only reference data).
export const references = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 2 }, 501),
);

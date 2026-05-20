import { Hono } from "hono";

// Phase 4: paid + pro bono cases (unified), accept/decline/close, activities, notes.
export const cases = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 4 }, 501),
);

import { Hono } from "hono";

// Phase 3: client profile, account status, my-cases summary.
export const clients = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 3 }, 501),
);

import { Hono } from "hono";

// Phase 7: account oversight, verification approvals, discount code mgmt.
// Will require role=admin + IP allowlist guard.
export const admin = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 7 }, 501),
);

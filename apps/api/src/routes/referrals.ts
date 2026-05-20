import { Hono } from "hono";

// Phase 6: lawyer-to-lawyer referral graph, referral links.
export const referrals = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 6 }, 501),
);

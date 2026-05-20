import { Hono } from "hono";

// Phase 2: profile, KYC submission, office (schedule/FAQs/theme), stats, visits.
export const lawyers = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 2 }, 501),
);

import { Hono } from "hono";

// Phase 5: invoices, payments, transactions, discount codes.
export const billing = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 5 }, 501),
);

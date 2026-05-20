import { Hono } from "hono";

// Phase 2+: S3 presigned PUT URLs for KYC docs, lawyer photos, client IDs.
export const files = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 2 }, 501),
);

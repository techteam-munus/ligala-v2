import { Hono } from "hono";

// Webhook endpoints land here, validate signature, then enqueue to SQS for
// processing by a worker Lambda. Sub-routes:
//   POST /paymongo   Phase 5
//   POST /paypal     Phase 5
//   POST /idmeta     Phase 2
export const webhooks = new Hono().post("/:provider", (c) =>
  c.json({ error: "not_implemented", provider: c.req.param("provider") }, 501),
);

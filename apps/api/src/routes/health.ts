import { Hono } from "hono";

export const health = new Hono().get("/", (c) =>
  c.json({
    status: "ok",
    service: "ligala-api",
    timestamp: new Date().toISOString(),
  }),
);

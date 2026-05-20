import { Hono } from "hono";

// Phase 1 mounts Better Auth here:
//   import { auth as betterAuth } from "@ligala/auth";
//   app.on(["POST", "GET"], "/*", (c) => betterAuth.handler(c.req.raw));
export const auth = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 1 }, 501),
);

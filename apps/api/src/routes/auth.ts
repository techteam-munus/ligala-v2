import { Hono } from "hono";
import { auth as betterAuth } from "@ligala/auth";

// Delegate everything under /auth/* to Better Auth. Web app shares the same
// session cookie (set by either side), so a sign-in via Next.js is immediately
// honored by these endpoints and vice versa.
export const auth = new Hono().on(["POST", "GET"], "/*", (c) =>
  betterAuth.handler(c.req.raw),
);

import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// Phase 1 will replace this with Better Auth session resolution and attach the
// session/user to the Hono context. For now it is a pass-through stub kept here
// so that route files can already mount `requireSession` without import churn.
export const requireSession: MiddlewareHandler = async (c, next) => {
  if (process.env.NODE_ENV === "production") {
    throw new HTTPException(501, { message: "auth_not_yet_implemented" });
  }
  await next();
};

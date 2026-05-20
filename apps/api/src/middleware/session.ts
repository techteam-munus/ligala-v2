import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "@ligala/auth";
import type { Session, User } from "@ligala/auth";

declare module "hono" {
  interface ContextVariableMap {
    user: User;
    session: Session["session"];
  }
}

/**
 * Resolve the Better Auth session from the request and attach it to the
 * Hono context. Throws 401 when no session is present.
 */
export const requireSession: MiddlewareHandler = async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) {
    throw new HTTPException(401, { message: "unauthorized" });
  }
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
};

/**
 * Same as requireSession but additionally checks the user has one of the
 * accepted roles.
 */
export const requireRole = (...roles: User["role"][]): MiddlewareHandler => {
  return async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!result) throw new HTTPException(401, { message: "unauthorized" });
    if (!roles.includes(result.user.role)) {
      throw new HTTPException(403, { message: "forbidden" });
    }
    c.set("user", result.user);
    c.set("session", result.session);
    await next();
  };
};

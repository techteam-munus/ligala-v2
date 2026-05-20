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
 * Block paused/banned accounts. Banned users get a hard 403 on all requests;
 * paused users may still GET (so they can read their own data + see their
 * status) but lose write methods. Admins are never blocked by their own status
 * (avoid locking ourselves out via the same audit endpoint that pauses).
 */
function assertStatus(
  user: { role: string | null | undefined; status?: string | null },
  method: string,
) {
  if (user.role === "admin") return;
  const status = user.status ?? "active";
  if (status === "banned") {
    throw new HTTPException(403, { message: "account_banned" });
  }
  if (status === "paused" && method !== "GET" && method !== "HEAD") {
    throw new HTTPException(403, { message: "account_paused" });
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
  assertStatus(result.user, c.req.method);
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
    assertStatus(result.user, c.req.method);
    c.set("user", result.user);
    c.set("session", result.session);
    await next();
  };
};

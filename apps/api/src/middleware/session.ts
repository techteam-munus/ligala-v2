import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "@ligala/auth";
import type { Session, User } from "@ligala/auth";
import { db, schema } from "@ligala/db";
import { eq } from "drizzle-orm";

type LawyerSubscription = typeof schema.lawyerSubscriptions.$inferSelect;

declare module "hono" {
  interface ContextVariableMap {
    user: User;
    session: Session["session"];
    /**
     * Populated only when user.role === "lawyer". Undefined for clients/admins
     * or for lawyers whose row was somehow never seeded (treat as expired).
     */
    subscription?: LawyerSubscription;
  }
}

/**
 * Routes an expired lawyer must still be able to hit (writes included) so they
 * can pay their way back in. Keep this set tiny — every entry weakens the gate.
 */
const SUBSCRIPTION_BYPASS_PATHS = new Set<string>([
  "/lawyer/subscription/checkout",
]);

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
 * Trial / paid-period gate for lawyers. Reads always pass (so an expired
 * lawyer can still see their own data and reach the subscribe page); writes
 * 403 with `subscription_expired` once `currentPeriodEndsAt` is in the past.
 * The bypass list above carves a hole for the checkout endpoint itself.
 *
 * A lawyer without any subscription row is treated as expired — defensive in
 * case the migration backfill ever misses someone.
 */
function assertLawyerSubscription(
  user: { role: string | null | undefined },
  sub: LawyerSubscription | undefined,
  method: string,
  path: string,
) {
  if (user.role !== "lawyer") return;
  if (method === "GET" || method === "HEAD") return;
  if (SUBSCRIPTION_BYPASS_PATHS.has(path)) return;
  if (!sub || sub.currentPeriodEndsAt.getTime() < Date.now()) {
    throw new HTTPException(403, { message: "subscription_expired" });
  }
}

async function loadLawyerSubscription(
  userId: string,
): Promise<LawyerSubscription | undefined> {
  return db().query.lawyerSubscriptions.findFirst({
    where: eq(schema.lawyerSubscriptions.lawyerId, userId),
  });
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
  const sub =
    result.user.role === "lawyer"
      ? await loadLawyerSubscription(result.user.id)
      : undefined;
  assertLawyerSubscription(result.user, sub, c.req.method, c.req.path);
  c.set("user", result.user);
  c.set("session", result.session);
  if (sub) c.set("subscription", sub);
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
    const sub =
      result.user.role === "lawyer"
        ? await loadLawyerSubscription(result.user.id)
        : undefined;
    assertLawyerSubscription(result.user, sub, c.req.method, c.req.path);
    c.set("user", result.user);
    c.set("session", result.session);
    if (sub) c.set("subscription", sub);
    await next();
  };
};

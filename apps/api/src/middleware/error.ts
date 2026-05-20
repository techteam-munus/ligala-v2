import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json(
      { error: err.message || "http_error", status: err.status },
      err.status,
    );
  }
  console.error("[api] unhandled error", err);
  // TODO Phase 0 — forward to Sentry once SENTRY_DSN is wired.
  return c.json({ error: "internal_error" }, 500);
}

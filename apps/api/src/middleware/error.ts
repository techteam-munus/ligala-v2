import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { captureException } from "../lib/sentry";

export function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json(
      { error: err.message || "http_error", status: err.status },
      err.status,
    );
  }
  console.error("[api] unhandled error", err);
  captureException(err, {
    method: c.req.method,
    path: c.req.path,
    requestId: c.req.header("x-amzn-requestid") ?? c.req.header("x-request-id"),
  });
  return c.json({ error: "internal_error" }, 500);
}

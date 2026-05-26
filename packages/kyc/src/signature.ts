import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an IDMeta webhook signature (HMAC-SHA256 hex over the raw body).
 * SANDBOX-CONFIRM (spec §11.2): header name + encoding are assumed; adjust the
 * caller's header lookup once confirmed. When no secret is configured we skip
 * verification (dev), matching the PayMongo webhook's "not configured" stance.
 */
export function verifyIdmetaSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return true; // dev / not configured
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

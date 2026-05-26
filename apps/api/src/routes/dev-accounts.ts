import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@ligala/db";
import { env } from "../lib/env";

/**
 * Dev-only, SESSION-LESS account helpers. Mounted at `/accounts/_dev` BEFORE
 * the auth-gated `/accounts` router so it skips `requireSession` (same
 * precedent as `/billing/dev`).
 *
 * Why session-less: under hard email verification (EMAIL_VERIFICATION_REQUIRED)
 * a freshly signed-up user has NO session — sign-up returns `token: null` and
 * sign-in is blocked with EMAIL_NOT_VERIFIED until the address is confirmed. A
 * session-bound verify route would therefore deadlock. This route takes the
 * email in the body so e2e automation can verify a user it just created.
 *
 * Gated on EMAIL_DEV_VERIFY_ENABLED: returns 404 when off, so it effectively
 * does not exist in prod (where the flag is never set).
 */
export const devAccounts = new Hono().post("/verify-email", async (c) => {
  // Gate first, before reading the body, so "disabled" looks like a missing
  // route regardless of payload.
  if (env().EMAIL_DEV_VERIFY_ENABLED !== "true") {
    return c.json({ message: "not_found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "invalid_body" }, 400);
  }

  const updated = await db()
    .update(schema.user)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(schema.user.email, parsed.data.email))
    .returning({ id: schema.user.id });

  if (updated.length === 0) {
    return c.json({ message: "user_not_found" }, 404);
  }
  return c.json({ ok: true });
});

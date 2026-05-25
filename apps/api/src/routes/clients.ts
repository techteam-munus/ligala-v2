import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import {
  claimIbpInput,
  clientProfilePatch,
  roleAssignmentInput,
} from "@ligala/shared/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { requireSession } from "../middleware/session";
import { slugify, withRandomSuffix } from "../lib/slug";
import { env } from "../lib/env";
import {
  SUBSCRIPTION_PRICE_CENTS,
  TRIAL_DAYS,
  addDays,
} from "../lib/subscription";

/**
 * Idempotent: only inserts the row if one doesn't already exist for the
 * lawyer. Re-claims (or admin role flips back-and-forth) preserve the
 * original trial dates rather than restarting the clock.
 */
async function ensureLawyerSubscription(userId: string) {
  const conn = db();
  const trialEnd = addDays(new Date(), TRIAL_DAYS);
  await conn
    .insert(schema.lawyerSubscriptions)
    .values({
      lawyerId: userId,
      status: "trialing",
      trialEndsAt: trialEnd,
      currentPeriodEndsAt: trialEnd,
      priceCents: SUBSCRIPTION_PRICE_CENTS,
    })
    .onConflictDoNothing({ target: schema.lawyerSubscriptions.lawyerId });
}

async function ensureLawyerProfile(userId: string, fallbackName: string | null) {
  const conn = db();
  const existing = await conn.query.lawyerProfiles.findFirst({
    where: eq(schema.lawyerProfiles.userId, userId),
  });
  if (existing) return existing;
  const base = slugify(fallbackName ?? "lawyer");
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const collision = await conn.query.lawyerProfiles.findFirst({
      where: eq(schema.lawyerProfiles.slug, slug),
    });
    if (!collision) break;
    slug = withRandomSuffix(base);
  }
  const [profile] = await conn
    .insert(schema.lawyerProfiles)
    .values({ userId, slug })
    .returning();
  return profile;
}

/**
 * Endpoints for the signed-in user's own account — independent of role.
 */
export const clients = new Hono()
  .use("*", requireSession)
  .get("/me", async (c) => {
    const user = c.get("user");
    return c.json({ user });
  })
  /**
   * Promote (or self-assign) a role. Today this is the only path from
   * role=client to role=lawyer. Idempotent: re-posting with the same role
   * is a no-op that returns the current user + (for lawyers) their profile.
   */
  .post("/role", zValidator("json", roleAssignmentInput), async (c) => {
    const user = c.get("user");
    const { role } = c.req.valid("json");
    const conn = db();

    if (role === "lawyer") {
      // Ensure the user row reflects the role and a lawyer_profile exists.
      await conn.update(schema.user).set({ role: "lawyer", updatedAt: new Date() }).where(eq(schema.user.id, user.id));
      const profile = await ensureLawyerProfile(user.id, user.name ?? user.email);
      await ensureLawyerSubscription(user.id);
      return c.json({ user: { ...user, role: "lawyer" }, profile });
    }

    // role === "client" — demotion path.
    await conn.update(schema.user).set({ role: "client", updatedAt: new Date() }).where(eq(schema.user.id, user.id));
    return c.json({ user: { ...user, role: "client" } });
  })

  /**
   * Claim an IBP directory record for the signed-in user. Consumes the
   * server-side handle minted by `POST /signup/verify-ibp` (passed by the
   * web app from a signed cookie). Idempotent if the same user re-claims
   * their own record. Rejects (409) if another user already claimed it.
   */
  .post("/claim-ibp", zValidator("json", claimIbpInput), async (c) => {
    const user = c.get("user");
    const { ibpLawyerId } = c.req.valid("json");
    const conn = db();

    const record = await conn.query.ibpLawyers.findFirst({
      where: eq(schema.ibpLawyers.id, ibpLawyerId),
    });
    if (!record) {
      throw new HTTPException(404, { message: "ibp_not_found" });
    }
    if (record.userId && record.userId !== user.id) {
      throw new HTTPException(409, { message: "ibp_already_claimed" });
    }

    if (!record.userId) {
      // Conditional update guards against a concurrent claim landing between
      // the read above and this write — only the first writer matches the
      // `user_id IS NULL` predicate.
      const claimed = await conn
        .update(schema.ibpLawyers)
        .set({ userId: user.id })
        .where(
          and(eq(schema.ibpLawyers.id, ibpLawyerId), isNull(schema.ibpLawyers.userId)),
        )
        .returning({ id: schema.ibpLawyers.id });
      if (claimed.length === 0) {
        throw new HTTPException(409, { message: "ibp_already_claimed" });
      }
    }

    await conn
      .update(schema.user)
      .set({ role: "lawyer", updatedAt: new Date() })
      .where(eq(schema.user.id, user.id));
    const profile = await ensureLawyerProfile(user.id, user.name ?? user.email);
    await ensureLawyerSubscription(user.id);
    return c.json({ ok: true, ibpLawyerId, profile });
  })

  /**
   * Client profile — auto-created on first read. Lazy initialization keeps
   * signup cheap and avoids a second migration step for existing users.
   */
  .get("/profile", async (c) => {
    const user = c.get("user");
    const conn = db();
    let profile = await conn.query.clientProfiles.findFirst({
      where: eq(schema.clientProfiles.userId, user.id),
    });
    if (!profile) {
      const [created] = await conn
        .insert(schema.clientProfiles)
        .values({ userId: user.id })
        .returning();
      profile = created;
    }
    return c.json({ profile });
  })

  .patch("/profile", zValidator("json", clientProfilePatch), async (c) => {
    const user = c.get("user");
    const patch = c.req.valid("json");
    const conn = db();

    // Upsert: insert with defaults if missing, then apply patch.
    await conn
      .insert(schema.clientProfiles)
      .values({ userId: user.id, ...patch })
      .onConflictDoUpdate({
        target: schema.clientProfiles.userId,
        set: { ...patch, updatedAt: new Date() },
      });

    const profile = await conn.query.clientProfiles.findFirst({
      where: eq(schema.clientProfiles.userId, user.id),
    });
    return c.json({ profile });
  })

  /**
   * Dev-only: mark the signed-in user's email as verified.
   * Only active when EMAIL_DEV_VERIFY_ENABLED=true. Returns 404 otherwise,
   * matching the pattern used by /billing/dev/* and /files/_dev/upload.
   */
  .post("/_dev/verify-email", async (c) => {
    if (env().EMAIL_DEV_VERIFY_ENABLED !== "true") {
      return c.json({ message: "not_found" }, 404);
    }
    const user = c.get("user");
    await db()
      .update(schema.user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(schema.user.id, user.id));
    return c.json({ ok: true });
  });

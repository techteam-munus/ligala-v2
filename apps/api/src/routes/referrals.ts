import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, or } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import {
  referralCreateInput,
  referralDecisionInput,
  referralLinkInput,
  referralLinkPatch,
} from "@ligala/shared/schemas";
import { requireSession } from "../middleware/session";

function newId() {
  return crypto.randomUUID();
}

/**
 * Pick a slug that fits the public-token regex and is unique. The user can
 * optionally pass their own (validated upstream); otherwise we generate one
 * from an ambiguity-free alphabet and retry on collision.
 */
const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
async function pickLinkSlug(preferred: string | undefined): Promise<string> {
  const conn = db();
  if (preferred) {
    const clash = await conn.query.referralLinks.findFirst({
      where: eq(schema.referralLinks.slug, preferred),
    });
    if (clash) throw new HTTPException(409, { message: "slug_taken" });
    return preferred;
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    let candidate = "";
    for (let i = 0; i < 8; i++) {
      candidate += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
    }
    const clash = await conn.query.referralLinks.findFirst({
      where: eq(schema.referralLinks.slug, candidate),
    });
    if (!clash) return candidate;
  }
  throw new HTTPException(500, { message: "slug_generation_failed" });
}

async function logCaseActivity(
  caseId: string,
  actorUserId: string,
  kind: (typeof schema.caseActivityKind.enumValues)[number],
  payload: Record<string, unknown> | null,
) {
  await db()
    .insert(schema.caseActivities)
    .values({ id: newId(), caseId, actorUserId, kind, payload });
}

export const referrals = new Hono()
  .use("*", requireSession)

  // --- List ----------------------------------------------------------------
  // Lawyers see their inbound + outbound referrals; admins see all.
  .get("/", async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer" && user.role !== "admin") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const conn = db();
    const where =
      user.role === "admin"
        ? undefined
        : or(
            eq(schema.referrals.fromLawyerId, user.id),
            eq(schema.referrals.toLawyerId, user.id),
          );
    const rows = await conn
      .select()
      .from(schema.referrals)
      .where(where)
      .orderBy(desc(schema.referrals.createdAt));
    return c.json({ items: rows });
  })

  // --- Create outbound case referral (lawyer-to-lawyer) --------------------
  .post("/", zValidator("json", referralCreateInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const input = c.req.valid("json");
    const conn = db();

    // Resolve recipient by slug, ensure they're verified (no point referring
    // a case to a lawyer the client wouldn't be able to hire).
    const recipient = await conn.query.lawyerProfiles.findFirst({
      where: eq(schema.lawyerProfiles.slug, input.toLawyerSlug),
    });
    if (!recipient) throw new HTTPException(404, { message: "recipient_not_found" });
    if (recipient.userId === user.id) {
      throw new HTTPException(400, { message: "self_referral" });
    }
    const latestKyc = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.lawyerId, recipient.userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    if (latestKyc?.status !== "approved") {
      throw new HTTPException(409, { message: "recipient_not_verified" });
    }

    // If caseId is supplied, the sender must own it AND it must be in a
    // referable status. We allow pending or accepted (paid not-yet-active);
    // closed/declined/cancelled is too late to hand off.
    if (input.caseId) {
      const caseRow = await conn.query.cases.findFirst({
        where: eq(schema.cases.id, input.caseId),
      });
      if (!caseRow) throw new HTTPException(404, { message: "case_not_found" });
      if (caseRow.lawyerId !== user.id) {
        throw new HTTPException(403, { message: "not_case_lawyer" });
      }
      if (!["pending", "accepted"].includes(caseRow.status)) {
        throw new HTTPException(409, { message: "case_not_referable" });
      }
    }

    const id = newId();
    const [created] = await conn
      .insert(schema.referrals)
      .values({
        id,
        kind: "case_referral",
        fromLawyerId: user.id,
        toLawyerId: recipient.userId,
        caseId: input.caseId ?? null,
        status: "pending",
        noteMd: input.noteMd ?? null,
      })
      .returning();

    if (input.caseId) {
      await logCaseActivity(input.caseId, user.id, "referred", {
        referralId: id,
        toLawyerSlug: input.toLawyerSlug,
      });
    }
    return c.json({ referral: created }, 201);
  })

  // --- Recipient decides ---------------------------------------------------
  .post("/:id/decision", zValidator("json", referralDecisionInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const id = c.req.param("id");
    const { decision, reason } = c.req.valid("json");
    const conn = db();

    const ref = await conn.query.referrals.findFirst({
      where: eq(schema.referrals.id, id),
    });
    if (!ref) throw new HTTPException(404, { message: "referral_not_found" });
    if (ref.toLawyerId !== user.id) {
      throw new HTTPException(403, { message: "not_recipient" });
    }
    if (ref.status !== "pending") {
      throw new HTTPException(409, { message: "referral_not_pending" });
    }

    const now = new Date();

    if (decision === "decline") {
      await conn
        .update(schema.referrals)
        .set({
          status: "declined",
          decidedAt: now,
          declineReason: reason ?? null,
          updatedAt: now,
        })
        .where(eq(schema.referrals.id, id));
      if (ref.caseId) {
        await logCaseActivity(ref.caseId, user.id, "referral_declined", {
          referralId: id,
          reason,
        });
      }
      return c.json({ status: "declined" });
    }

    // Accept: if a case is attached, reassign it to the recipient and reset
    // its status to `pending` so they can run the normal accept flow.
    await conn
      .update(schema.referrals)
      .set({ status: "accepted", decidedAt: now, updatedAt: now })
      .where(eq(schema.referrals.id, id));

    if (ref.caseId) {
      await conn
        .update(schema.cases)
        .set({
          lawyerId: user.id,
          status: "pending",
          decidedAt: null,
          updatedAt: now,
          referralId: id,
        })
        .where(eq(schema.cases.id, ref.caseId));
      await logCaseActivity(ref.caseId, user.id, "referral_accepted", {
        referralId: id,
      });
    }

    return c.json({ status: "accepted" });
  })

  // --- Referral links (per-lawyer share codes) -----------------------------
  .get("/links", async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const rows = await db()
      .select()
      .from(schema.referralLinks)
      .where(eq(schema.referralLinks.lawyerId, user.id))
      .orderBy(desc(schema.referralLinks.createdAt));
    return c.json({ items: rows });
  })

  .post("/links", zValidator("json", referralLinkInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const input = c.req.valid("json");
    const slug = await pickLinkSlug(input.slug);
    const [link] = await db()
      .insert(schema.referralLinks)
      .values({
        id: newId(),
        lawyerId: user.id,
        slug,
        label: input.label ?? null,
        active: true,
      })
      .returning();
    return c.json({ link }, 201);
  })

  .patch("/links/:id", zValidator("json", referralLinkPatch), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const id = c.req.param("id");
    const patch = c.req.valid("json");
    const conn = db();
    const owned = await conn.query.referralLinks.findFirst({
      where: and(
        eq(schema.referralLinks.id, id),
        eq(schema.referralLinks.lawyerId, user.id),
      ),
    });
    if (!owned) throw new HTTPException(404, { message: "link_not_found" });
    await conn
      .update(schema.referralLinks)
      .set(patch)
      .where(eq(schema.referralLinks.id, id));
    return c.json({ ok: true });
  })

  .delete("/links/:id", async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const id = c.req.param("id");
    const conn = db();
    const owned = await conn.query.referralLinks.findFirst({
      where: and(
        eq(schema.referralLinks.id, id),
        eq(schema.referralLinks.lawyerId, user.id),
      ),
    });
    if (!owned) throw new HTTPException(404, { message: "link_not_found" });
    await conn.delete(schema.referralLinks).where(eq(schema.referralLinks.id, id));
    return c.body(null, 204);
  });

/**
 * Public lookup for a referral link by slug. No auth — the client portal
 * uses this on the case-creation form to pre-fill the referring lawyer and
 * bump the click counter so the lawyer sees engagement on inactive links.
 */
export const referralLinksPublic = new Hono()
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug").toUpperCase();
    const conn = db();
    const link = await conn.query.referralLinks.findFirst({
      where: eq(schema.referralLinks.slug, slug),
    });
    if (!link || !link.active) {
      throw new HTTPException(404, { message: "link_not_found" });
    }
    const profile = await conn.query.lawyerProfiles.findFirst({
      where: eq(schema.lawyerProfiles.userId, link.lawyerId),
    });
    if (!profile) throw new HTTPException(404, { message: "link_not_found" });

    // Best-effort click counter — no auth, so abusers can pad the number.
    // For real attribution we lean on `signups` which the case-creation
    // path increments under an authenticated session.
    await conn
      .update(schema.referralLinks)
      .set({ clicks: link.clicks + 1 })
      .where(eq(schema.referralLinks.id, link.id));

    return c.json({
      slug: link.slug,
      label: link.label,
      lawyer: { slug: profile.slug, userId: profile.userId },
    });
  });

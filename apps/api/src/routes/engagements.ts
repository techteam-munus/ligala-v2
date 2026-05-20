import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import {
  engagementDecisionInput,
  engagementInput,
} from "@ligala/shared/schemas";
import { requireSession } from "../middleware/session";

function newId() {
  return crypto.randomUUID();
}

async function logActivity(
  caseId: string,
  actorUserId: string | null,
  kind: (typeof schema.caseActivityKind.enumValues)[number],
  payload: Record<string, unknown> | null = null,
) {
  await db()
    .insert(schema.caseActivities)
    .values({ id: newId(), caseId, actorUserId, kind, payload });
}

/**
 * Engagements live on accepted, paid cases. Pro bono cases never get one —
 * they jump from accepted to active on accept.
 *
 * Two endpoints:
 *   POST /cases/:caseId/engagement     — lawyer sends terms (creates engagement)
 *   POST /engagements/:id/decision     — client signs or declines
 */
export const engagements = new Hono()
  .use("*", requireSession)

  /**
   * Send terms. Mounted via app.route("/engagements/cases/...") — Hono needs
   * the caseId-first route on this router so /engagements/:id/decision below
   * doesn't shadow it.
   */
  .post("/cases/:caseId", zValidator("json", engagementInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const caseRow = await db().query.cases.findFirst({
      where: eq(schema.cases.id, c.req.param("caseId")),
    });
    if (!caseRow) throw new HTTPException(404, { message: "case_not_found" });
    if (caseRow.lawyerId !== user.id) {
      throw new HTTPException(403, { message: "forbidden" });
    }
    if (caseRow.type !== "paid") {
      throw new HTTPException(409, { message: "engagement_not_applicable" });
    }
    if (caseRow.status !== "accepted") {
      throw new HTTPException(409, { message: "case_not_accepted" });
    }

    const existing = await db().query.engagements.findFirst({
      where: eq(schema.engagements.caseId, caseRow.id),
    });
    if (existing) {
      throw new HTTPException(409, { message: "engagement_already_exists" });
    }

    const input = c.req.valid("json");
    const id = newId();
    const [engagement] = await db()
      .insert(schema.engagements)
      .values({
        id,
        caseId: caseRow.id,
        rateType: input.rateType,
        hourlyCents: input.hourlyCents ?? null,
        flatCents: input.flatCents ?? null,
        contingencyBps: input.contingencyBps ?? null,
        termsMd: input.termsMd,
        status: "sent",
      })
      .returning();
    await logActivity(caseRow.id, user.id, "engagement_sent", {
      engagementId: id,
      rateType: input.rateType,
    });
    return c.json({ engagement }, 201);
  })

  /**
   * Client signs or declines.
   */
  .post(
    "/:id/decision",
    zValidator("json", engagementDecisionInput),
    async (c) => {
      const user = c.get("user");
      const id = c.req.param("id");
      const engagement = await db().query.engagements.findFirst({
        where: eq(schema.engagements.id, id),
      });
      if (!engagement)
        throw new HTTPException(404, { message: "engagement_not_found" });
      const caseRow = await db().query.cases.findFirst({
        where: eq(schema.cases.id, engagement.caseId),
      });
      if (!caseRow) throw new HTTPException(404, { message: "case_not_found" });

      if (user.role !== "client" || caseRow.clientId !== user.id) {
        throw new HTTPException(403, { message: "client_only" });
      }
      if (engagement.status !== "sent") {
        throw new HTTPException(409, { message: "engagement_not_pending" });
      }

      const { decision, reason } = c.req.valid("json");
      const now = new Date();
      const conn = db();

      if (decision === "decline") {
        await conn
          .update(schema.engagements)
          .set({
            status: "declined",
            decidedAt: now,
            declineReason: reason ?? null,
            updatedAt: now,
          })
          .where(eq(schema.engagements.id, id));
        await logActivity(caseRow.id, user.id, "engagement_declined", {
          engagementId: id,
          reason,
        });
        return c.json({ status: "declined" });
      }

      // sign — flip engagement to signed, and case to active.
      await conn
        .update(schema.engagements)
        .set({ status: "signed", decidedAt: now, updatedAt: now })
        .where(eq(schema.engagements.id, id));
      await conn
        .update(schema.cases)
        .set({ status: "active", updatedAt: now })
        .where(eq(schema.cases.id, caseRow.id));
      await logActivity(caseRow.id, user.id, "engagement_signed", {
        engagementId: id,
      });
      await logActivity(caseRow.id, user.id, "activated", {
        reason: "engagement_signed",
      });
      return c.json({ status: "signed" });
    },
  );

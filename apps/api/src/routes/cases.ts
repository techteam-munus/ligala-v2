import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import {
  caseAttachmentInput,
  caseCloseInput,
  caseCreateInput,
  caseDecisionInput,
  caseNoteInput,
} from "@ligala/shared/schemas";
import { requireSession } from "../middleware/session";

function newId() {
  return crypto.randomUUID();
}

/**
 * Audit-log helper. Every state-changing handler calls this so the timeline
 * shown to client + lawyer is reconstructable from a single table.
 */
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
 * Load the case and assert the current user is allowed to see it.
 * Clients see their own; lawyers see ones assigned to them; admins see all.
 */
async function loadCaseFor(
  caseId: string,
  user: { id: string; role: string | null | undefined },
) {
  const c = await db().query.cases.findFirst({
    where: eq(schema.cases.id, caseId),
  });
  if (!c) throw new HTTPException(404, { message: "case_not_found" });
  const owned =
    (user.role === "client" && c.clientId === user.id) ||
    (user.role === "lawyer" && c.lawyerId === user.id) ||
    user.role === "admin";
  if (!owned) throw new HTTPException(403, { message: "forbidden" });
  return c;
}

export const cases = new Hono()
  .use("*", requireSession)

  // --- List -----------------------------------------------------------------
  .get("/", async (c) => {
    const user = c.get("user");
    const conn = db();
    const where =
      user.role === "client"
        ? eq(schema.cases.clientId, user.id)
        : user.role === "lawyer"
          ? eq(schema.cases.lawyerId, user.id)
          : undefined;
    const rows = await conn
      .select()
      .from(schema.cases)
      .where(where)
      .orderBy(desc(schema.cases.updatedAt));
    return c.json({ items: rows });
  })

  // --- Create (client only) -------------------------------------------------
  .post("/", zValidator("json", caseCreateInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "client") {
      throw new HTTPException(403, { message: "clients_only" });
    }
    const input = c.req.valid("json");
    const conn = db();

    // Resolve lawyer by slug, and require the lawyer to be KYC-verified
    // (mirrors the directory visibility gate — clients shouldn't be able to
    // submit a case to an unverified lawyer).
    const profile = await conn.query.lawyerProfiles.findFirst({
      where: eq(schema.lawyerProfiles.slug, input.lawyerSlug),
    });
    if (!profile) throw new HTTPException(404, { message: "lawyer_not_found" });
    const latestKyc = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.lawyerId, profile.userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    if (latestKyc?.status !== "approved") {
      throw new HTTPException(409, { message: "lawyer_not_verified" });
    }

    const id = newId();
    const [created] = await conn
      .insert(schema.cases)
      .values({
        id,
        clientId: user.id,
        lawyerId: profile.userId,
        type: input.type,
        status: "pending",
        title: input.title,
        description: input.description,
        practiceAreaId: input.practiceAreaId ?? null,
        jurisdictionId: input.jurisdictionId ?? null,
      })
      .returning();
    await logActivity(id, user.id, "created", { type: input.type });
    return c.json({ case: created }, 201);
  })

  // --- Read -----------------------------------------------------------------
  .get("/:id", async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const engagement = await db().query.engagements.findFirst({
      where: eq(schema.engagements.caseId, caseRow.id),
    });
    return c.json({ case: caseRow, engagement: engagement ?? null });
  })

  // --- Lawyer accept/decline ------------------------------------------------
  .post("/:id/decision", zValidator("json", caseDecisionInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const { decision, reason } = c.req.valid("json");

    if (caseRow.status !== "pending") {
      throw new HTTPException(409, { message: "case_not_pending" });
    }

    const conn = db();
    const now = new Date();

    if (decision === "decline") {
      await conn
        .update(schema.cases)
        .set({
          status: "declined",
          decidedAt: now,
          declineReason: reason ?? null,
          updatedAt: now,
        })
        .where(eq(schema.cases.id, caseRow.id));
      await logActivity(caseRow.id, user.id, "declined", { reason });
      return c.json({ status: "declined" });
    }

    // accept — for pro bono cases there's no engagement, jump straight to active.
    const nextStatus = caseRow.type === "probono" ? "active" : "accepted";
    await conn
      .update(schema.cases)
      .set({ status: nextStatus, decidedAt: now, updatedAt: now })
      .where(eq(schema.cases.id, caseRow.id));
    await logActivity(caseRow.id, user.id, "accepted", null);
    if (nextStatus === "active") {
      await logActivity(caseRow.id, user.id, "activated", { reason: "probono_accepted" });
    }
    return c.json({ status: nextStatus });
  })

  // --- Close / cancel -------------------------------------------------------
  .post("/:id/close", zValidator("json", caseCloseInput), async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const { action, reason } = c.req.valid("json");

    if (action === "cancel") {
      // Only the client can cancel, and only before active.
      if (user.role !== "client" || caseRow.clientId !== user.id) {
        throw new HTTPException(403, { message: "client_only" });
      }
      if (!["pending", "accepted"].includes(caseRow.status)) {
        throw new HTTPException(409, { message: "case_not_cancellable" });
      }
      const now = new Date();
      await db()
        .update(schema.cases)
        .set({
          status: "cancelled",
          closedAt: now,
          closeReason: reason ?? null,
          updatedAt: now,
        })
        .where(eq(schema.cases.id, caseRow.id));
      await logActivity(caseRow.id, user.id, "cancelled", { reason });
      return c.json({ status: "cancelled" });
    }

    // close — either party, only when active.
    if (caseRow.status !== "active") {
      throw new HTTPException(409, { message: "case_not_active" });
    }
    const now = new Date();
    await db()
      .update(schema.cases)
      .set({
        status: "closed",
        closedAt: now,
        closeReason: reason ?? null,
        updatedAt: now,
      })
      .where(eq(schema.cases.id, caseRow.id));
    await logActivity(caseRow.id, user.id, "closed", { reason });
    return c.json({ status: "closed" });
  })

  // --- Notes ----------------------------------------------------------------
  .get("/:id/notes", async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const conn = db();

    // Visibility filter: shared (both); lawyer (lawyer + author); client (client + author).
    const visibilityForRole =
      user.role === "client"
        ? (["shared", "client"] as const)
        : user.role === "lawyer"
          ? (["shared", "lawyer"] as const)
          : (["shared", "lawyer", "client"] as const);

    const notes = await conn
      .select()
      .from(schema.caseNotes)
      .where(
        and(
          eq(schema.caseNotes.caseId, caseRow.id),
          or(
            inArray(schema.caseNotes.visibility, [...visibilityForRole]),
            eq(schema.caseNotes.authorUserId, user.id),
          ),
        ),
      )
      .orderBy(asc(schema.caseNotes.createdAt));
    return c.json({ notes });
  })

  .post("/:id/notes", zValidator("json", caseNoteInput), async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const { body, visibility } = c.req.valid("json");
    // Clients can't post lawyer-only notes; lawyers can't post client-only.
    if (
      (user.role === "client" && visibility === "lawyer") ||
      (user.role === "lawyer" && visibility === "client")
    ) {
      throw new HTTPException(403, { message: "visibility_not_allowed" });
    }
    const id = newId();
    const [note] = await db()
      .insert(schema.caseNotes)
      .values({
        id,
        caseId: caseRow.id,
        authorUserId: user.id,
        visibility,
        body,
      })
      .returning();
    await logActivity(caseRow.id, user.id, "note_added", { noteId: id });
    return c.json({ note }, 201);
  })

  // --- Attachments ----------------------------------------------------------
  .get("/:id/attachments", async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const items = await db()
      .select()
      .from(schema.caseAttachments)
      .where(eq(schema.caseAttachments.caseId, caseRow.id))
      .orderBy(desc(schema.caseAttachments.createdAt));
    return c.json({ items });
  })

  .post("/:id/attachments", zValidator("json", caseAttachmentInput), async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const input = c.req.valid("json");
    const id = newId();
    const [attachment] = await db()
      .insert(schema.caseAttachments)
      .values({
        id,
        caseId: caseRow.id,
        uploaderUserId: user.id,
        s3Key: input.s3Key,
        filename: input.filename,
        mime: input.mime,
        sizeBytes: input.sizeBytes ?? null,
      })
      .returning();
    await logActivity(caseRow.id, user.id, "attachment_added", {
      attachmentId: id,
      filename: input.filename,
    });
    return c.json({ attachment }, 201);
  })

  // --- Activities (read-only timeline) --------------------------------------
  .get("/:id/activities", async (c) => {
    const user = c.get("user");
    const caseRow = await loadCaseFor(c.req.param("id"), user);
    const items = await db()
      .select()
      .from(schema.caseActivities)
      .where(eq(schema.caseActivities.caseId, caseRow.id))
      .orderBy(asc(schema.caseActivities.createdAt));
    return c.json({ items });
  });

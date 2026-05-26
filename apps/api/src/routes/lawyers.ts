import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import {
  kycSubmissionInput,
  lawyerProfilePatch,
  officeFaqInput,
  officeInput,
  officePatch,
  officeScheduleInput,
} from "@ligala/shared/schemas";
import { requireRole } from "../middleware/session";
import { hostedUrlFor } from "@ligala/kyc";

/**
 * All endpoints here require role=lawyer. The role-promotion path lives at
 * POST /accounts/role.
 */
function newId() {
  return crypto.randomUUID();
}

export const lawyers = new Hono()
  .use("*", requireRole("lawyer"))

  // --- Profile ----------------------------------------------------------------
  .get("/profile", async (c) => {
    const user = c.get("user");
    const profile = await db().query.lawyerProfiles.findFirst({
      where: eq(schema.lawyerProfiles.userId, user.id),
    });
    if (!profile) throw new HTTPException(404, { message: "profile_not_found" });

    const practiceAreas = await db()
      .select({ id: schema.lawyerPracticeAreas.practiceAreaId })
      .from(schema.lawyerPracticeAreas)
      .where(eq(schema.lawyerPracticeAreas.lawyerId, user.id));
    const jurisdictions = await db()
      .select({ id: schema.lawyerJurisdictions.jurisdictionId })
      .from(schema.lawyerJurisdictions)
      .where(eq(schema.lawyerJurisdictions.lawyerId, user.id));

    return c.json({
      profile,
      practiceAreaIds: practiceAreas.map((p) => p.id),
      jurisdictionIds: jurisdictions.map((j) => j.id),
    });
  })

  .patch("/profile", zValidator("json", lawyerProfilePatch), async (c) => {
    const user = c.get("user");
    const patch = c.req.valid("json");
    const conn = db();

    const { practiceAreaIds, jurisdictionIds, ...profileFields } = patch;

    if (Object.keys(profileFields).length > 0) {
      await conn
        .update(schema.lawyerProfiles)
        .set({ ...profileFields, updatedAt: new Date() })
        .where(eq(schema.lawyerProfiles.userId, user.id));
    }

    if (practiceAreaIds) {
      await conn.delete(schema.lawyerPracticeAreas).where(eq(schema.lawyerPracticeAreas.lawyerId, user.id));
      if (practiceAreaIds.length > 0) {
        await conn
          .insert(schema.lawyerPracticeAreas)
          .values(practiceAreaIds.map((id) => ({ lawyerId: user.id, practiceAreaId: id })));
      }
    }

    if (jurisdictionIds) {
      await conn.delete(schema.lawyerJurisdictions).where(eq(schema.lawyerJurisdictions.lawyerId, user.id));
      if (jurisdictionIds.length > 0) {
        await conn
          .insert(schema.lawyerJurisdictions)
          .values(jurisdictionIds.map((id) => ({ lawyerId: user.id, jurisdictionId: id })));
      }
    }

    return c.json({ ok: true });
  })

  // --- KYC --------------------------------------------------------------------
  .get("/kyc", async (c) => {
    const user = c.get("user");
    const submission = await db().query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.lawyerId, user.id),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    if (!submission) return c.json({ submission: null, documents: [] });
    const documents = await db()
      .select()
      .from(schema.kycDocuments)
      .where(eq(schema.kycDocuments.submissionId, submission.id));
    return c.json({ submission, documents });
  })

  .post("/kyc", zValidator("json", kycSubmissionInput), async (c) => {
    const user = c.get("user");
    const { documents } = c.req.valid("json");
    const conn = db();
    const submissionId = newId();
    const now = new Date();
    await conn.insert(schema.kycSubmissions).values({
      id: submissionId,
      lawyerId: user.id,
      status: "submitted",
      submittedAt: now,
    });
    await conn.insert(schema.kycDocuments).values(
      documents.map((d) => ({
        id: newId(),
        submissionId,
        kind: d.kind,
        s3Key: d.s3Key,
      })),
    );
    return c.json({ submissionId, status: "submitted" }, 201);
  })

  .post("/kyc/idmeta/start", async (c) => {
    const user = c.get("user");
    if (!process.env.IDMETA_HOSTED_URL) {
      throw new HTTPException(501, { message: "idmeta_not_configured" });
    }

    const conn = db();
    // Reuse an existing open (pending) IDMeta submission rather than creating a
    // new one on every launch — repeated "Start" clicks shouldn't pile up stale
    // pending rows. A new submission is created only once the prior one is
    // decided (approved/rejected) and the lawyer re-verifies.
    const open = await conn.query.kycSubmissions.findFirst({
      where: and(
        eq(schema.kycSubmissions.lawyerId, user.id),
        eq(schema.kycSubmissions.method, "idmeta"),
        eq(schema.kycSubmissions.status, "pending"),
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    const submissionId = open?.id ?? newId();
    if (!open) {
      await conn.insert(schema.kycSubmissions).values({
        id: submissionId,
        lawyerId: user.id,
        status: "pending",
        method: "idmeta",
      });
    }

    // Launch the hosted SDK with our submissionId attached as metadata (m=
    // param). IDMeta's SDK creates the verification and echoes the metadata back
    // in the trustValidation.complete webhook, which is how we map the result to
    // this submission — no pre-created verification / token needed at launch.
    return c.json({ hostedUrl: hostedUrlFor(submissionId), submissionId });
  })

  // --- Office -----------------------------------------------------------------
  .get("/office", async (c) => {
    const user = c.get("user");
    const office = await db().query.offices.findFirst({
      where: eq(schema.offices.lawyerId, user.id),
    });
    if (!office) return c.json({ office: null, schedule: [], faqs: [] });
    const schedule = await db()
      .select()
      .from(schema.officeSchedules)
      .where(eq(schema.officeSchedules.officeId, office.id))
      .orderBy(asc(schema.officeSchedules.dayOfWeek));
    const faqs = await db()
      .select()
      .from(schema.officeFaqs)
      .where(eq(schema.officeFaqs.officeId, office.id))
      .orderBy(asc(schema.officeFaqs.sortOrder));
    return c.json({ office, schedule, faqs });
  })

  .post("/office", zValidator("json", officeInput), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const existing = await db().query.offices.findFirst({
      where: eq(schema.offices.lawyerId, user.id),
    });
    if (existing) throw new HTTPException(409, { message: "office_already_exists" });
    const [office] = await db()
      .insert(schema.offices)
      .values({ id: newId(), lawyerId: user.id, ...input })
      .returning();
    return c.json({ office }, 201);
  })

  .patch("/office", zValidator("json", officePatch), async (c) => {
    const user = c.get("user");
    const patch = c.req.valid("json");
    await db()
      .update(schema.offices)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.offices.lawyerId, user.id));
    return c.json({ ok: true });
  })

  // --- Office Schedule (whole-week replace) ----------------------------------
  .put("/office/schedule", zValidator("json", officeScheduleInput), async (c) => {
    const user = c.get("user");
    const { entries } = c.req.valid("json");
    const office = await db().query.offices.findFirst({
      where: eq(schema.offices.lawyerId, user.id),
    });
    if (!office) throw new HTTPException(404, { message: "office_not_found" });
    const conn = db();
    await conn.delete(schema.officeSchedules).where(eq(schema.officeSchedules.officeId, office.id));
    if (entries.length > 0) {
      await conn
        .insert(schema.officeSchedules)
        .values(entries.map((e) => ({ officeId: office.id, ...e })));
    }
    return c.json({ ok: true });
  })

  // --- Office FAQs ------------------------------------------------------------
  .post("/office/faqs", zValidator("json", officeFaqInput), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const office = await db().query.offices.findFirst({
      where: eq(schema.offices.lawyerId, user.id),
    });
    if (!office) throw new HTTPException(404, { message: "office_not_found" });
    const [faq] = await db()
      .insert(schema.officeFaqs)
      .values({ id: newId(), officeId: office.id, ...input })
      .returning();
    return c.json({ faq }, 201);
  })

  .delete("/office/faqs/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const office = await db().query.offices.findFirst({
      where: eq(schema.offices.lawyerId, user.id),
    });
    if (!office) throw new HTTPException(404, { message: "office_not_found" });
    await db()
      .delete(schema.officeFaqs)
      .where(and(eq(schema.officeFaqs.id, id), eq(schema.officeFaqs.officeId, office.id)));
    return c.body(null, 204);
  });

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@ligala/db";
import {
  adminDiscountCodeCreateInput,
  adminInvoiceListQuery,
  adminListQuery,
  adminUserRoleInput,
  forceVerifyLawyerInput,
  ibpLawyerCreateInput,
  ibpLawyerListQuery,
  kycAdminDecisionInput,
  refundInput,
  userStatusInput,
} from "@ligala/shared/schemas";
import { requireRole } from "../middleware/session";
import { adminIpAllowlist } from "../middleware/admin-ip-allowlist";
import { env } from "../lib/env";
import { refundPayment } from "./billing";

function newId() {
  return crypto.randomUUID();
}

/**
 * Append-only admin audit row. Every mutating admin handler MUST call this in
 * the same request so the log is a faithful record of "who changed what why."
 */
async function logAdmin(
  actorAdminId: string,
  action: (typeof schema.adminAuditAction.enumValues)[number],
  subjectType: string,
  subjectId: string,
  payload: Record<string, unknown> | null,
  reason: string | null,
) {
  await db()
    .insert(schema.adminAuditLog)
    .values({
      id: newId(),
      actorAdminId,
      action,
      subjectType,
      subjectId,
      payload,
      reason,
    });
}

export const admin = new Hono()
  // IP allowlist runs first so an off-IP probe gets 403 before any session
  // lookup happens — keeps admin paths invisible to the open internet.
  .use("*", adminIpAllowlist)
  .use("*", requireRole("admin"))

  // --- Stats ---------------------------------------------------------------
  .get("/stats", async (c) => {
    const conn = db();
    const [users, kycPending, invoicesPaid, refundsToday, activeReferrals] =
      await Promise.all([
        conn
          .select({
            role: schema.user.role,
            status: schema.user.status,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.user)
          .groupBy(schema.user.role, schema.user.status),
        conn
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.kycSubmissions)
          .where(eq(schema.kycSubmissions.status, "submitted")),
        conn
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.invoices)
          .where(eq(schema.invoices.status, "paid")),
        conn
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.transactions)
          .where(eq(schema.transactions.kind, "refund")),
        conn
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.referrals)
          .where(eq(schema.referrals.status, "pending")),
      ]);
    return c.json({
      users,
      kycPendingCount: kycPending[0]?.count ?? 0,
      invoicesPaidCount: invoicesPaid[0]?.count ?? 0,
      refundsAllTime: refundsToday[0]?.count ?? 0,
      activeReferrals: activeReferrals[0]?.count ?? 0,
    });
  })

  // --- Users: list ---------------------------------------------------------
  .get("/users", zValidator("query", adminListQuery), async (c) => {
    const { q, role, status, page, pageSize } = c.req.valid("query");
    const conn = db();
    const filters = [];
    if (q && q.trim().length > 0) {
      const like = `%${q.trim()}%`;
      filters.push(or(ilike(schema.user.email, like), ilike(schema.user.name, like))!);
    }
    if (role) filters.push(eq(schema.user.role, role));
    if (status) filters.push(eq(schema.user.status, status));
    const where = filters.length > 0 ? and(...filters) : undefined;

    const countRows = await conn
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.user)
      .where(where);
    const total = countRows[0]?.count ?? 0;

    const rows = await conn
      .select()
      .from(schema.user)
      .where(where)
      .orderBy(desc(schema.user.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return c.json({ items: rows, total, page, pageSize });
  })

  // --- Users: detail -------------------------------------------------------
  .get("/users/:id", async (c) => {
    const conn = db();
    const u = await conn.query.user.findFirst({
      where: eq(schema.user.id, c.req.param("id")),
    });
    if (!u) throw new HTTPException(404, { message: "user_not_found" });
    const [lawyerProfile, clientProfile, kyc, audit] = await Promise.all([
      conn.query.lawyerProfiles.findFirst({
        where: eq(schema.lawyerProfiles.userId, u.id),
      }),
      conn.query.clientProfiles.findFirst({
        where: eq(schema.clientProfiles.userId, u.id),
      }),
      conn
        .select()
        .from(schema.kycSubmissions)
        .where(eq(schema.kycSubmissions.lawyerId, u.id))
        .orderBy(desc(schema.kycSubmissions.createdAt)),
      conn
        .select()
        .from(schema.adminAuditLog)
        .where(eq(schema.adminAuditLog.subjectId, u.id))
        .orderBy(desc(schema.adminAuditLog.createdAt))
        .limit(20),
    ]);
    return c.json({
      user: u,
      lawyerProfile: lawyerProfile ?? null,
      clientProfile: clientProfile ?? null,
      kycSubmissions: kyc,
      auditLog: audit,
    });
  })

  // --- Users: status (pause/ban/restore) -----------------------------------
  .post("/users/:id/status", zValidator("json", userStatusInput), async (c) => {
    const actor = c.get("user");
    const { status, reason } = c.req.valid("json");
    const id = c.req.param("id");
    const conn = db();
    const target = await conn.query.user.findFirst({
      where: eq(schema.user.id, id),
    });
    if (!target) throw new HTTPException(404, { message: "user_not_found" });
    if (target.id === actor.id) {
      throw new HTTPException(400, { message: "cannot_change_own_status" });
    }
    await conn
      .update(schema.user)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.user.id, id));
    await logAdmin(actor.id, "user_status_changed", "user", id, {
      previous: target.status,
      next: status,
    }, reason);
    return c.json({ ok: true, status });
  })

  // --- Users: role assignment ----------------------------------------------
  .post("/users/:id/role", zValidator("json", adminUserRoleInput), async (c) => {
    const actor = c.get("user");
    const { role, reason } = c.req.valid("json");
    const id = c.req.param("id");
    const conn = db();
    const target = await conn.query.user.findFirst({
      where: eq(schema.user.id, id),
    });
    if (!target) throw new HTTPException(404, { message: "user_not_found" });
    if (target.id === actor.id) {
      throw new HTTPException(400, { message: "cannot_change_own_role" });
    }
    await conn
      .update(schema.user)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.user.id, id));
    await logAdmin(actor.id, "user_role_changed", "user", id, {
      previous: target.role,
      next: role,
    }, reason);
    return c.json({ ok: true, role });
  })

  // --- Users: force-verify (testing helper, non-prod only) -----------------
  // Synthesizes an approved kyc_submission so the lawyer surfaces in the
  // public directory without going through the real KYC flow. Idempotent
  // when the latest submission is already approved.
  .post(
    "/users/:id/force-verify",
    zValidator("json", forceVerifyLawyerInput),
    async (c) => {
      if (env().NODE_ENV === "production") {
        throw new HTTPException(403, { message: "force_verify_disabled_in_prod" });
      }
      const actor = c.get("user");
      const { reason } = c.req.valid("json");
      const id = c.req.param("id");
      const conn = db();
      const target = await conn.query.user.findFirst({
        where: eq(schema.user.id, id),
      });
      if (!target) throw new HTTPException(404, { message: "user_not_found" });
      if (target.role !== "lawyer") {
        throw new HTTPException(400, { message: "not_a_lawyer" });
      }
      const profile = await conn.query.lawyerProfiles.findFirst({
        where: eq(schema.lawyerProfiles.userId, id),
      });
      if (!profile) {
        throw new HTTPException(400, { message: "no_lawyer_profile" });
      }
      const latest = await conn.query.kycSubmissions.findFirst({
        where: eq(schema.kycSubmissions.lawyerId, id),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });
      if (latest?.status === "approved") {
        return c.json({ ok: true, alreadyVerified: true });
      }
      const submissionId = newId();
      const now = new Date();
      await conn.insert(schema.kycSubmissions).values({
        id: submissionId,
        lawyerId: id,
        status: "approved",
        submittedAt: now,
        decidedAt: now,
        decidedBy: actor.id,
      });
      await logAdmin(
        actor.id,
        "kyc_force_approved",
        "user",
        id,
        { submissionId, lawyerId: id },
        reason,
      );
      return c.json({ ok: true, submissionId, alreadyVerified: false });
    },
  )

  // --- KYC: pending inbox + manual decision --------------------------------
  .get("/kyc", async (c) => {
    const conn = db();
    const rows = await conn
      .select({
        submission: schema.kycSubmissions,
        lawyerEmail: schema.user.email,
        lawyerName: schema.user.name,
      })
      .from(schema.kycSubmissions)
      .innerJoin(schema.user, eq(schema.user.id, schema.kycSubmissions.lawyerId))
      .where(eq(schema.kycSubmissions.status, "submitted"))
      .orderBy(desc(schema.kycSubmissions.createdAt));
    return c.json({ items: rows });
  })

  .post("/kyc/:id/decision", zValidator("json", kycAdminDecisionInput), async (c) => {
    const actor = c.get("user");
    const { decision, reason } = c.req.valid("json");
    const conn = db();
    const submission = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.id, c.req.param("id")),
    });
    if (!submission) throw new HTTPException(404, { message: "kyc_not_found" });
    if (submission.status !== "submitted") {
      throw new HTTPException(409, { message: "kyc_not_pending" });
    }
    const next = decision === "approve" ? "approved" : "rejected";
    const now = new Date();
    await conn
      .update(schema.kycSubmissions)
      .set({
        status: next,
        decidedAt: now,
        rejectReason: next === "rejected" ? reason ?? null : null,
        updatedAt: now,
      })
      .where(eq(schema.kycSubmissions.id, submission.id));
    await logAdmin(
      actor.id,
      "kyc_decided",
      "kyc_submission",
      submission.id,
      { decision: next, lawyerId: submission.lawyerId },
      reason ?? null,
    );
    return c.json({ ok: true, status: next });
  })

  // --- Discount codes: global list + admin create + moderation removal -----
  .get("/discount-codes", async (c) => {
    const conn = db();
    const rows = await conn
      .select({
        code: schema.discountCodes,
        lawyerEmail: schema.user.email,
        lawyerName: schema.user.name,
        lawyerRole: schema.user.role,
      })
      .from(schema.discountCodes)
      .innerJoin(schema.user, eq(schema.user.id, schema.discountCodes.lawyerId))
      .orderBy(desc(schema.discountCodes.createdAt));
    return c.json({ items: rows });
  })

  /**
   * Mint an admin-owned discount code for lawyer subscription billing. The
   * row is owned by the admin (`lawyerId = actor.id`); the subscription
   * lookup at `apps/api/src/lib/subscription-discount.ts` finds it by joining
   * to user.role='admin'. No `scope` column — owner role is the marker.
   */
  .post(
    "/discount-codes",
    zValidator("json", adminDiscountCodeCreateInput),
    async (c) => {
      const actor = c.get("user");
      const input = c.req.valid("json");
      const id = newId();
      const codeText = input.code.toUpperCase();
      let row;
      try {
        [row] = await db()
          .insert(schema.discountCodes)
          .values({
            id,
            lawyerId: actor.id,
            code: codeText,
            kind: input.kind,
            valueBps: input.valueBps ?? null,
            valueCents: input.valueCents ?? null,
            minSubtotalCents: input.minSubtotalCents ?? null,
            maxRedemptions: input.maxRedemptions ?? null,
            validFrom: input.validFrom ? new Date(input.validFrom) : null,
            validUntil: input.validUntil ? new Date(input.validUntil) : null,
          })
          .returning();
      } catch (err) {
        const pgcode = (err as { code?: string } | null)?.code;
        if (pgcode === "23505") {
          throw new HTTPException(409, { message: "code_already_exists" });
        }
        throw err;
      }
      await logAdmin(
        actor.id,
        "discount_code_created",
        "discount_code",
        id,
        {
          code: codeText,
          kind: input.kind,
          valueBps: input.valueBps ?? null,
          valueCents: input.valueCents ?? null,
          minSubtotalCents: input.minSubtotalCents ?? null,
          maxRedemptions: input.maxRedemptions ?? null,
          validFrom: input.validFrom ?? null,
          validUntil: input.validUntil ?? null,
        },
        input.reason,
      );
      return c.json({ code: row }, 201);
    },
  )

  .delete("/discount-codes/:id", async (c) => {
    const actor = c.get("user");
    const id = c.req.param("id");
    const conn = db();
    const code = await conn.query.discountCodes.findFirst({
      where: eq(schema.discountCodes.id, id),
    });
    if (!code) throw new HTTPException(404, { message: "code_not_found" });
    const reason = c.req.query("reason") ?? "moderation_removal";
    await conn.delete(schema.discountCodes).where(eq(schema.discountCodes.id, id));
    await logAdmin(actor.id, "discount_code_removed", "discount_code", id, {
      code: code.code,
      lawyerId: code.lawyerId,
    }, reason);
    return c.body(null, 204);
  })

  // --- Referrals: read-only graph ------------------------------------------
  .get("/referrals", async (c) => {
    const conn = db();
    const rows = await conn
      .select()
      .from(schema.referrals)
      .orderBy(desc(schema.referrals.createdAt))
      .limit(200);
    return c.json({ items: rows });
  })

  // --- Invoices: search + refund -------------------------------------------
  .get("/invoices", zValidator("query", adminInvoiceListQuery), async (c) => {
    const { q, status, page, pageSize } = c.req.valid("query");
    const conn = db();
    const filters = [];
    if (q && q.trim().length > 0) {
      filters.push(ilike(schema.invoices.number, `%${q.trim()}%`));
    }
    if (status) filters.push(eq(schema.invoices.status, status));
    const where = filters.length > 0 ? and(...filters) : undefined;

    const countRows = await conn
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.invoices)
      .where(where);
    const total = countRows[0]?.count ?? 0;

    const lawyerUser = alias(schema.user, "lawyer_user");
    const clientUser = alias(schema.user, "client_user");
    const rows = await conn
      .select({
        invoice: schema.invoices,
        lawyerName: lawyerUser.name,
        lawyerEmail: lawyerUser.email,
        clientName: clientUser.name,
        clientEmail: clientUser.email,
      })
      .from(schema.invoices)
      .leftJoin(lawyerUser, eq(lawyerUser.id, schema.invoices.lawyerId))
      .leftJoin(clientUser, eq(clientUser.id, schema.invoices.clientId))
      .where(where)
      .orderBy(desc(schema.invoices.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Platform pulse — intentionally unfiltered so the KPI strip is stable as
    // the admin types in the search box.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const statsRows = await conn
      .select({
        outstandingCents: sql<number>`coalesce(sum(case when ${schema.invoices.status} in ('sent','partially_paid') then ${schema.invoices.totalCents} - ${schema.invoices.paidCents} else 0 end), 0)::int`,
        overdueCents: sql<number>`coalesce(sum(case when ${schema.invoices.status} in ('sent','partially_paid') and ${schema.invoices.dueAt} is not null and ${schema.invoices.dueAt} < now() then ${schema.invoices.totalCents} - ${schema.invoices.paidCents} else 0 end), 0)::int`,
        collected30Cents: sql<number>`coalesce(sum(case when ${schema.invoices.paidAt} is not null and ${schema.invoices.paidAt} >= ${thirtyDaysAgo} then ${schema.invoices.paidCents} else 0 end), 0)::int`,
        outstandingCount: sql<number>`coalesce(sum(case when ${schema.invoices.status} in ('sent','partially_paid') then 1 else 0 end), 0)::int`,
        overdueCount: sql<number>`coalesce(sum(case when ${schema.invoices.status} in ('sent','partially_paid') and ${schema.invoices.dueAt} is not null and ${schema.invoices.dueAt} < now() then 1 else 0 end), 0)::int`,
      })
      .from(schema.invoices);
    const stats = statsRows[0] ?? {
      outstandingCents: 0,
      overdueCents: 0,
      collected30Cents: 0,
      outstandingCount: 0,
      overdueCount: 0,
    };

    return c.json({
      items: rows.map((r) => ({
        ...r.invoice,
        lawyer: r.lawyerName
          ? { name: r.lawyerName, email: r.lawyerEmail }
          : null,
        client: r.clientName
          ? { name: r.clientName, email: r.clientEmail }
          : null,
      })),
      total,
      page,
      pageSize,
      stats,
    });
  })

  .post("/invoices/:id/refund", zValidator("json", refundInput), async (c) => {
    const actor = c.get("user");
    const { paymentId, amountCents, reason } = c.req.valid("json");
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    const payment = await conn.query.payments.findFirst({
      where: and(
        eq(schema.payments.id, paymentId),
        eq(schema.payments.invoiceId, invoice.id),
      ),
    });
    if (!payment) {
      throw new HTTPException(404, { message: "payment_not_on_invoice" });
    }
    const result = await refundPayment({
      paymentId,
      amountCents,
      providerRefundId: `admin_${newId().slice(0, 8)}`,
      note: reason,
    });
    await logAdmin(actor.id, "invoice_refunded", "invoice", invoice.id, {
      paymentId,
      amountCents,
      result,
    }, reason);
    return c.json(result);
  })

  // --- IBP lawyers directory: list + add -----------------------------------
  .get("/ibp-lawyers", zValidator("query", ibpLawyerListQuery), async (c) => {
    const { q, page, pageSize } = c.req.valid("query");
    const conn = db();
    const filters = [];
    if (q && q.trim().length > 0) {
      const like = `%${q.trim()}%`;
      filters.push(
        or(
          ilike(schema.ibpLawyers.firstName, like),
          ilike(schema.ibpLawyers.middleName, like),
          ilike(schema.ibpLawyers.lastName, like),
          ilike(schema.ibpLawyers.rollNumber, like),
        )!,
      );
    }
    const where = filters.length > 0 ? and(...filters) : undefined;

    const countRows = await conn
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.ibpLawyers)
      .where(where);
    const total = countRows[0]?.count ?? 0;

    const rows = await conn
      .select()
      .from(schema.ibpLawyers)
      .where(where)
      .orderBy(desc(schema.ibpLawyers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return c.json({ items: rows, total, page, pageSize });
  })

  .post("/ibp-lawyers", zValidator("json", ibpLawyerCreateInput), async (c) => {
    const actor = c.get("user");
    const input = c.req.valid("json");
    const conn = db();
    const id = newId();
    // `date` columns expect YYYY-MM-DD strings; trim time off the parsed Date.
    const rollSignedIso = input.rollSigned.toISOString().slice(0, 10);
    try {
      await conn.insert(schema.ibpLawyers).values({
        id,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        address: input.address,
        rollSigned: rollSignedIso,
        rollNumber: input.rollNumber,
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        throw new HTTPException(409, { message: "roll_number_taken" });
      }
      throw err;
    }
    await logAdmin(
      actor.id,
      "ibp_lawyer_added",
      "ibp_lawyer",
      id,
      {
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        rollNumber: input.rollNumber,
      },
      input.reason,
    );
    return c.json({ ok: true, id });
  })

  // --- Audit log read ------------------------------------------------------
  .get("/audit-log", async (c) => {
    const conn = db();
    const subjectType = c.req.query("subjectType");
    const subjectId = c.req.query("subjectId");
    const filters = [];
    if (subjectType) filters.push(eq(schema.adminAuditLog.subjectType, subjectType));
    if (subjectId) filters.push(eq(schema.adminAuditLog.subjectId, subjectId));
    const where = filters.length > 0 ? and(...filters) : undefined;
    const rows = await conn
      .select({
        log: schema.adminAuditLog,
        actorName: schema.user.name,
        actorEmail: schema.user.email,
      })
      .from(schema.adminAuditLog)
      .innerJoin(schema.user, eq(schema.user.id, schema.adminAuditLog.actorAdminId))
      .where(where)
      .orderBy(desc(schema.adminAuditLog.createdAt))
      .limit(100);
    return c.json({ items: rows });
  });

// Suppress unused-import warning when the inArray helper is needed for future
// filters; keeping the import wired avoids churn on the next admin extension.
void inArray;

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import {
  applyDiscountInput,
  checkoutInput,
  discountCodeInput,
  invoiceCreateInput,
  invoicePatch,
  invoiceVoidInput,
} from "@ligala/shared/schemas";
import { dispatchEmail } from "@ligala/email";
import { requireRole, requireSession } from "../middleware/session";
import {
  computeDiscountCents,
  computeLineTotalCents,
  newInvoiceNumber,
} from "../lib/billing";
import { RENEWAL_DAYS, addDays } from "../lib/subscription";
import { env } from "../lib/env";
import { formatDate, formatPhp } from "../lib/format";
import {
  createCheckoutSession,
  PAYMONGO_MIN_AMOUNT_CENTS,
  PaymongoApiError,
  PaymongoUnreachableError,
} from "../lib/paymongo";
import { clearsAtForEarning, refundReversalCents } from "../lib/payouts";

function newId() {
  return crypto.randomUUID();
}

/**
 * Recompute totals from current lines + applied discount and persist on the
 * invoice. Called after every mutation while in draft, and at send time.
 */
export async function recomputeInvoiceTotals(invoiceId: string) {
  const conn = db();
  const lines = await conn
    .select({
      lineTotalCents: schema.invoiceLines.lineTotalCents,
    })
    .from(schema.invoiceLines)
    .where(eq(schema.invoiceLines.invoiceId, invoiceId));
  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);

  const invoice = await conn.query.invoices.findFirst({
    where: eq(schema.invoices.id, invoiceId),
  });
  if (!invoice) return;

  let discountCents = 0;
  if (invoice.appliedDiscountCodeId) {
    const code = await conn.query.discountCodes.findFirst({
      where: eq(schema.discountCodes.id, invoice.appliedDiscountCodeId),
    });
    if (code) discountCents = computeDiscountCents(subtotalCents, code);
  }

  const totalCents = Math.max(0, subtotalCents - discountCents);
  await conn
    .update(schema.invoices)
    .set({ subtotalCents, discountCents, totalCents, updatedAt: new Date() })
    .where(eq(schema.invoices.id, invoiceId));
}

export const billing = new Hono()
  .use("*", requireSession)

  // --- Invoices: list ------------------------------------------------------
  // Returns each invoice plus the counterparty user row for the requesting
  // role: the client (for a lawyer's view) or the lawyer (for a client's view).
  // `subscription` invoices have no client, so counterparty is null there.
  .get("/invoices", async (c) => {
    const user = c.get("user");
    const conn = db();
    const where =
      user.role === "client"
        ? eq(schema.invoices.clientId, user.id)
        : user.role === "lawyer"
          ? eq(schema.invoices.lawyerId, user.id)
          : undefined;
    const counterpartyIdCol =
      user.role === "lawyer" ? schema.invoices.clientId : schema.invoices.lawyerId;
    const rows = await conn
      .select({
        invoice: schema.invoices,
        counterpartyName: schema.user.name,
        counterpartyEmail: schema.user.email,
      })
      .from(schema.invoices)
      .leftJoin(schema.user, eq(schema.user.id, counterpartyIdCol))
      .where(where)
      .orderBy(desc(schema.invoices.updatedAt));
    return c.json({
      items: rows.map((r) => ({
        ...r.invoice,
        counterparty: r.counterpartyName
          ? { name: r.counterpartyName, email: r.counterpartyEmail }
          : null,
      })),
    });
  })

  // --- Invoices: create (lawyer only) --------------------------------------
  .post("/invoices", zValidator("json", invoiceCreateInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const input = c.req.valid("json");
    const conn = db();

    const caseRow = await conn.query.cases.findFirst({
      where: eq(schema.cases.id, input.caseId),
    });
    if (!caseRow) throw new HTTPException(404, { message: "case_not_found" });
    if (caseRow.lawyerId !== user.id) {
      throw new HTTPException(403, { message: "forbidden" });
    }
    if (!["accepted", "active", "closed"].includes(caseRow.status)) {
      throw new HTTPException(409, { message: "case_not_billable" });
    }

    const engagement = await conn.query.engagements.findFirst({
      where: eq(schema.engagements.caseId, caseRow.id),
    });

    // Retry-on-collision for the human-readable number (very unlikely).
    let id = newId();
    let number = newInvoiceNumber();
    let createdInvoice: typeof schema.invoices.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [row] = await conn
          .insert(schema.invoices)
          .values({
            id,
            number,
            caseId: caseRow.id,
            engagementId: engagement?.id ?? null,
            clientId: caseRow.clientId,
            lawyerId: caseRow.lawyerId,
            currency: input.currency,
            notesMd: input.notesMd ?? null,
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
          })
          .returning();
        createdInvoice = row;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("number")) throw err;
        id = newId();
        number = newInvoiceNumber();
      }
    }
    if (!createdInvoice) {
      throw new HTTPException(500, { message: "invoice_number_collision" });
    }

    await conn.insert(schema.invoiceLines).values(
      input.lines.map((l, i) => ({
        id: newId(),
        invoiceId: createdInvoice!.id,
        description: l.description,
        qtyThousandths: l.qtyThousandths,
        unitAmountCents: l.unitAmountCents,
        lineTotalCents: computeLineTotalCents(l.unitAmountCents, l.qtyThousandths),
        sortOrder: i,
      })),
    );
    await recomputeInvoiceTotals(createdInvoice.id);

    const reread = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, createdInvoice.id),
    });
    return c.json({ invoice: reread }, 201);
  })

  // --- Invoices: read ------------------------------------------------------
  .get("/invoices/:id", async (c) => {
    const user = c.get("user");
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    const owned =
      (user.role === "client" && invoice.clientId === user.id) ||
      (user.role === "lawyer" && invoice.lawyerId === user.id) ||
      user.role === "admin";
    if (!owned) throw new HTTPException(403, { message: "forbidden" });

    const [lines, payments, transactions, appliedCode] = await Promise.all([
      conn
        .select()
        .from(schema.invoiceLines)
        .where(eq(schema.invoiceLines.invoiceId, invoice.id))
        .orderBy(asc(schema.invoiceLines.sortOrder)),
      conn
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.invoiceId, invoice.id))
        .orderBy(desc(schema.payments.createdAt)),
      conn
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.invoiceId, invoice.id))
        .orderBy(desc(schema.transactions.createdAt)),
      invoice.appliedDiscountCodeId
        ? conn.query.discountCodes.findFirst({
            where: eq(schema.discountCodes.id, invoice.appliedDiscountCodeId),
          })
        : Promise.resolve(null),
    ]);

    return c.json({ invoice, lines, payments, transactions, appliedCode });
  })

  // --- Invoices: patch (draft only, lawyer only) ---------------------------
  .patch("/invoices/:id", zValidator("json", invoicePatch), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    if (invoice.lawyerId !== user.id) {
      throw new HTTPException(403, { message: "forbidden" });
    }
    if (invoice.status !== "draft") {
      throw new HTTPException(409, { message: "invoice_not_editable" });
    }

    const patch = c.req.valid("json");

    if (patch.lines) {
      await conn
        .delete(schema.invoiceLines)
        .where(eq(schema.invoiceLines.invoiceId, invoice.id));
      await conn.insert(schema.invoiceLines).values(
        patch.lines.map((l, i) => ({
          id: newId(),
          invoiceId: invoice.id,
          description: l.description,
          qtyThousandths: l.qtyThousandths,
          unitAmountCents: l.unitAmountCents,
          lineTotalCents: computeLineTotalCents(l.unitAmountCents, l.qtyThousandths),
          sortOrder: i,
        })),
      );
    }

    if (patch.notesMd !== undefined || patch.dueAt !== undefined) {
      await conn
        .update(schema.invoices)
        .set({
          ...(patch.notesMd !== undefined ? { notesMd: patch.notesMd } : {}),
          ...(patch.dueAt !== undefined
            ? { dueAt: patch.dueAt ? new Date(patch.dueAt) : null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.invoices.id, invoice.id));
    }

    await recomputeInvoiceTotals(invoice.id);
    return c.json({ ok: true });
  })

  // --- Invoices: apply discount (client OR lawyer; draft/sent only) --------
  .post("/invoices/:id/discount", zValidator("json", applyDiscountInput), async (c) => {
    const user = c.get("user");
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    const owned =
      (user.role === "client" && invoice.clientId === user.id) ||
      (user.role === "lawyer" && invoice.lawyerId === user.id);
    if (!owned) throw new HTTPException(403, { message: "forbidden" });
    if (!["draft", "sent"].includes(invoice.status)) {
      throw new HTTPException(409, { message: "invoice_locked" });
    }

    const { code } = c.req.valid("json");
    const codeRow = await conn.query.discountCodes.findFirst({
      where: and(
        eq(schema.discountCodes.lawyerId, invoice.lawyerId),
        eq(schema.discountCodes.code, code.toUpperCase()),
      ),
    });
    if (!codeRow) throw new HTTPException(404, { message: "code_not_found" });

    const now = new Date();
    if (codeRow.validFrom && codeRow.validFrom > now) {
      throw new HTTPException(409, { message: "code_not_yet_valid" });
    }
    if (codeRow.validUntil && codeRow.validUntil < now) {
      throw new HTTPException(409, { message: "code_expired" });
    }
    if (
      codeRow.maxRedemptions != null &&
      codeRow.redemptions >= codeRow.maxRedemptions
    ) {
      throw new HTTPException(409, { message: "code_exhausted" });
    }
    if (
      codeRow.minSubtotalCents != null &&
      invoice.subtotalCents < codeRow.minSubtotalCents
    ) {
      throw new HTTPException(409, { message: "subtotal_too_low" });
    }

    await conn
      .update(schema.invoices)
      .set({ appliedDiscountCodeId: codeRow.id, updatedAt: new Date() })
      .where(eq(schema.invoices.id, invoice.id));
    await recomputeInvoiceTotals(invoice.id);
    return c.json({ ok: true });
  })

  // --- Invoices: send (lawyer only, draft only) ----------------------------
  .post("/invoices/:id/send", async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    if (invoice.lawyerId !== user.id) {
      throw new HTTPException(403, { message: "forbidden" });
    }
    if (invoice.status !== "draft") {
      throw new HTTPException(409, { message: "invoice_already_sent" });
    }
    if (invoice.totalCents <= 0) {
      throw new HTTPException(409, { message: "invoice_total_must_be_positive" });
    }

    const now = new Date();
    await conn
      .update(schema.invoices)
      .set({ status: "sent", sentAt: now, updatedAt: now })
      .where(eq(schema.invoices.id, invoice.id));

    // Enqueue invoice_sent email — only for case invoices (subscription invoices
    // have no clientId). The session user IS the lawyer (enforced above), so
    // user.name is used directly; no second DB lookup needed.
    if (invoice.clientId) {
      try {
        const clientUser = await conn.query.user.findFirst({
          where: eq(schema.user.id, invoice.clientId),
        });
        if (clientUser?.email) {
          await dispatchEmail({
            kind: "invoice_sent",
            to: clientUser.email,
            dedupeKey: `invoice_sent:${invoice.id}`,
            data: {
              clientName: clientUser.name,
              lawyerName: user.name,
              invoiceNumber: invoice.number,
              amountFormatted: formatPhp(invoice.totalCents),
              currency: invoice.currency,
              invoiceUrl: `${env().BETTER_AUTH_URL}/invoices/${invoice.id}`,
            },
          });
        }
      } catch (err) {
        console.error("[email] invoice_sent dispatch failed", invoice.id, err);
      }
    }

    return c.json({ ok: true });
  })

  // --- Invoices: void (lawyer only, pre-paid) ------------------------------
  .post("/invoices/:id/void", zValidator("json", invoiceVoidInput), async (c) => {
    const user = c.get("user");
    if (user.role !== "lawyer") {
      throw new HTTPException(403, { message: "lawyers_only" });
    }
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    if (invoice.lawyerId !== user.id) {
      throw new HTTPException(403, { message: "forbidden" });
    }
    if (["paid", "void"].includes(invoice.status)) {
      throw new HTTPException(409, { message: "invoice_locked" });
    }

    const { reason } = c.req.valid("json");
    const now = new Date();
    await conn
      .update(schema.invoices)
      .set({ status: "void", voidedAt: now, voidReason: reason, updatedAt: now })
      .where(eq(schema.invoices.id, invoice.id));
    return c.json({ ok: true });
  })

  // --- Invoices: checkout (client; returns provider URL) -------------------
  .post("/invoices/:id/checkout", zValidator("json", checkoutInput), async (c) => {
    const user = c.get("user");
    const conn = db();
    const invoice = await conn.query.invoices.findFirst({
      where: eq(schema.invoices.id, c.req.param("id")),
    });
    if (!invoice) throw new HTTPException(404, { message: "invoice_not_found" });
    if (user.role !== "client" || invoice.clientId !== user.id) {
      throw new HTTPException(403, { message: "client_only" });
    }
    if (!["sent", "partially_paid"].includes(invoice.status)) {
      throw new HTTPException(409, { message: "invoice_not_payable" });
    }

    const { provider } = c.req.valid("json");
    const remaining = Math.max(0, invoice.totalCents - invoice.paidCents);
    if (remaining <= 0) {
      throw new HTTPException(409, { message: "invoice_already_paid" });
    }

    if (provider === "paypal") {
      throw new HTTPException(501, { message: "paypal_not_enabled" });
    }

    if (provider === "paymongo") {
      const secretKey = env().PAYMONGO_SECRET_KEY;
      if (!secretKey) {
        console.warn("paymongo_not_configured: PAYMONGO_SECRET_KEY is unset");
        throw new HTTPException(501, { message: "paymongo_not_configured" });
      }
      if (remaining < PAYMONGO_MIN_AMOUNT_CENTS) {
        throw new HTTPException(409, { message: "amount_below_paymongo_minimum" });
      }
      const baseUrl = env().BETTER_AUTH_URL;
      try {
        const session = await createCheckoutSession({
          secretKey,
          amountCents: remaining,
          currency: "PHP",
          lineDescription: `Ligala invoice ${invoice.number}`,
          successUrl: `${baseUrl}/invoices/${invoice.id}?status=success`,
          cancelUrl: `${baseUrl}/invoices/${invoice.id}?status=cancelled`,
          referenceNumber: invoice.id,
          metadata: { invoiceId: invoice.id, lawyerId: invoice.lawyerId },
          customerEmail: user.email,
        });
        return c.json({
          provider,
          providerPaymentId: session.sessionId,
          amountCents: remaining,
          currency: invoice.currency,
          checkoutUrl: session.checkoutUrl,
        });
      } catch (err) {
        if (err instanceof PaymongoApiError) {
          console.error(
            "paymongo_request_failed",
            err.status,
            err.bodyText.slice(0, 200),
          );
          throw new HTTPException(502, { message: "paymongo_request_failed" });
        }
        if (err instanceof PaymongoUnreachableError) {
          console.error("paymongo_unreachable", err.cause);
          throw new HTTPException(502, { message: "paymongo_unreachable" });
        }
        throw err;
      }
    }

    // provider === "dev_simulate": stays available so the existing Playwright
    // + manual smoke flows work without provisioning real PayMongo keys.
    const intentId = `pi_${provider}_${crypto.randomUUID().slice(0, 12)}`;
    const apiOrigin = c.req.url.split(c.req.path)[0];
    return c.json({
      provider,
      providerPaymentId: intentId,
      amountCents: remaining,
      currency: invoice.currency,
      checkoutUrl: `${apiOrigin}/billing/dev/simulate-payment?invoiceId=${invoice.id}&providerPaymentId=${intentId}&provider=${provider}`,
    });
  })

  // --- Transactions ledger -------------------------------------------------
  .get("/transactions", async (c) => {
    const user = c.get("user");
    const conn = db();
    const subq =
      user.role === "client"
        ? eq(schema.invoices.clientId, user.id)
        : user.role === "lawyer"
          ? eq(schema.invoices.lawyerId, user.id)
          : undefined;
    if (subq === undefined) {
      const rows = await conn
        .select()
        .from(schema.transactions)
        .orderBy(desc(schema.transactions.createdAt));
      return c.json({ items: rows });
    }
    const myInvoiceIds = await conn
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(subq);
    const ids = myInvoiceIds.map((r) => r.id);
    if (ids.length === 0) return c.json({ items: [] });
    const rows = await conn
      .select()
      .from(schema.transactions)
      .where(
        or(
          isNull(schema.transactions.invoiceId),
          ...ids.map((id) => eq(schema.transactions.invoiceId, id)),
        ),
      )
      .orderBy(desc(schema.transactions.createdAt));
    return c.json({ items: rows });
  });

/**
 * Dev-only payment simulator. The browser hits this directly via the
 * `checkoutUrl` returned by /billing/invoices/:id/checkout when the chosen
 * provider is `dev_simulate`, and so it MUST NOT require a session (the
 * browser can't share the web origin's auth cookie cross-origin with the
 * API). Mounted as its own router so it sits outside `billing`'s
 * `requireSession` middleware. In production this stays available behind the
 * existing UI flag-gating (Subscribe button only exposes it when
 * `NODE_ENV !== "production"` + `?simulate=1`).
 */
export const billingDev = new Hono().post("/simulate-payment", async (c) => {
  const url = new URL(c.req.url);
  const invoiceId = url.searchParams.get("invoiceId");
  const providerPaymentId = url.searchParams.get("providerPaymentId");
  const provider = url.searchParams.get("provider") ?? "dev_simulate";
  const status = url.searchParams.get("status") === "failed" ? "failed" : "succeeded";
  if (!invoiceId || !providerPaymentId) {
    throw new HTTPException(400, { message: "missing_params" });
  }
  const result = await applyPaymentWebhook({
    provider: provider as "paymongo" | "paypal" | "dev_simulate",
    providerPaymentId,
    invoiceId,
    status,
  });
  return c.json(result);
});

/**
 * Lawyer-owned discount codes. Mounted at /billing/discount-codes.
 */
export const discountCodesRouter = new Hono()
  .use("*", requireRole("lawyer"))
  .get("/", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.discountCodes)
      .where(eq(schema.discountCodes.lawyerId, user.id))
      .orderBy(desc(schema.discountCodes.createdAt));
    return c.json({ items: rows });
  })
  .post("/", zValidator("json", discountCodeInput), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const [row] = await db()
      .insert(schema.discountCodes)
      .values({
        id: crypto.randomUUID(),
        lawyerId: user.id,
        code: input.code.toUpperCase(),
        kind: input.kind,
        valueBps: input.valueBps ?? null,
        valueCents: input.valueCents ?? null,
        minSubtotalCents: input.minSubtotalCents ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
      })
      .returning();
    return c.json({ code: row }, 201);
  });

/**
 * Idempotent webhook handler shared by /webhooks/{paymongo,paypal} and the
 * dev simulate endpoint. Dedup key is (provider, providerPaymentId).
 */
export async function applyPaymentWebhook(input: {
  provider: "paymongo" | "paypal" | "dev_simulate";
  providerPaymentId: string;
  invoiceId: string;
  status: "succeeded" | "failed";
  amountCents?: number;
  currency?: string;
  failureReason?: string;
  /** PayMongo collection fee (cents); 0/undefined when unknown. */
  feeCents?: number;
  rawPayload?: unknown;
}) {
  const conn = db();

  const invoice = await conn.query.invoices.findFirst({
    where: eq(schema.invoices.id, input.invoiceId),
  });
  if (!invoice) {
    throw new HTTPException(404, { message: "invoice_not_found" });
  }

  // Idempotency: if we've seen this providerPaymentId before, no-op.
  const existing = await conn.query.payments.findFirst({
    where: and(
      eq(schema.payments.provider, input.provider),
      eq(schema.payments.providerPaymentId, input.providerPaymentId),
    ),
  });
  if (existing) {
    return { idempotent: true, paymentId: existing.id, status: existing.status };
  }

  const now = new Date();
  const amount = input.amountCents ?? invoice.totalCents - invoice.paidCents;
  const currency = input.currency ?? invoice.currency;
  const wasUnpaid = invoice.paidCents === 0;

  const paymentId = crypto.randomUUID();
  await conn.insert(schema.payments).values({
    id: paymentId,
    invoiceId: invoice.id,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    status: input.status,
    amountCents: amount,
    currency,
    succeededAt: input.status === "succeeded" ? now : null,
    failedAt: input.status === "failed" ? now : null,
    failureReason: input.failureReason ?? null,
    rawPayload: input.rawPayload ?? null,
  });

  if (input.status === "succeeded") {
    await conn.insert(schema.transactions).values({
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      paymentId,
      kind: "charge",
      direction: "credit",
      amountCents: amount,
      currency,
      note: `Payment via ${input.provider}`,
    });

    // Lawyer earnings: only for case invoices (subscription invoices are
    // platform revenue, not lawyer earnings). Pass-through model — credit the
    // full gross as `earning`, debit only PayMongo's real collection fee. Both
    // clear together after the configured window.
    if (invoice.kind !== "subscription") {
      const feeCents = input.feeCents ?? 0;
      const clearsAt = clearsAtForEarning(now, env().PAYOUT_CLEARING_DAYS);
      await conn.insert(schema.balanceEntries).values({
        id: crypto.randomUUID(),
        lawyerId: invoice.lawyerId,
        kind: "earning",
        direction: "credit",
        amountCents: amount,
        currency,
        clearsAt,
        relatedPaymentId: paymentId,
        note: `Earning from invoice ${invoice.number}`,
      });
      if (feeCents > 0) {
        await conn.insert(schema.balanceEntries).values({
          id: crypto.randomUUID(),
          lawyerId: invoice.lawyerId,
          kind: "processing_fee",
          direction: "debit",
          amountCents: feeCents,
          currency,
          clearsAt,
          relatedPaymentId: paymentId,
          note: `PayMongo collection fee for invoice ${invoice.number}`,
        });
      }
    }

    const newPaid = invoice.paidCents + amount;
    const fullyPaid = newPaid >= invoice.totalCents;
    await conn
      .update(schema.invoices)
      .set({
        paidCents: newPaid,
        paidAt: fullyPaid ? now : invoice.paidAt,
        status: fullyPaid ? "paid" : "partially_paid",
        updatedAt: now,
      })
      .where(eq(schema.invoices.id, invoice.id));

    // Bump discount code redemptions on first successful payment.
    if (invoice.appliedDiscountCodeId && wasUnpaid) {
      const code = await conn.query.discountCodes.findFirst({
        where: eq(schema.discountCodes.id, invoice.appliedDiscountCodeId),
      });
      if (code) {
        await conn
          .update(schema.discountCodes)
          .set({ redemptions: code.redemptions + 1 })
          .where(eq(schema.discountCodes.id, code.id));
      }
    }

    // Subscription renewal: extend the lawyer's paid period. The earlier
    // dedup check on (provider, providerPaymentId) means we only get here
    // once per provider payment, so the +30 days is never double-applied.
    let subscriptionPeriodEnd: Date | undefined;
    if (invoice.kind === "subscription") {
      const sub = await conn.query.lawyerSubscriptions.findFirst({
        where: eq(schema.lawyerSubscriptions.lawyerId, invoice.lawyerId),
      });
      if (sub) {
        // Stack onto the existing period if it hasn't elapsed yet (early
        // renewal); otherwise start a fresh period from `now`.
        const base = sub.currentPeriodEndsAt > now ? sub.currentPeriodEndsAt : now;
        const newPeriodEnd = addDays(base, RENEWAL_DAYS);
        subscriptionPeriodEnd = newPeriodEnd;
        await conn
          .update(schema.lawyerSubscriptions)
          .set({
            status: "active",
            currentPeriodEndsAt: newPeriodEnd,
            lastPaidAt: now,
            updatedAt: now,
          })
          .where(eq(schema.lawyerSubscriptions.lawyerId, invoice.lawyerId));
      }
    }

    // Enqueue receipt emails — payment.id-keyed dedupeKey means replays
    // (same providerPaymentId) are already blocked above by the existing
    // check; the try/catch ensures a recipient-lookup failure can't unwind
    // a billing op that has already committed.
    if (invoice.kind === "subscription") {
      try {
        if (!subscriptionPeriodEnd) {
          console.error(
            "[email] subscription row missing, skipping receipt",
            invoice.lawyerId,
          );
        } else {
          const lawyerUser = await conn.query.user.findFirst({
            where: eq(schema.user.id, invoice.lawyerId),
          });
          if (lawyerUser?.email) {
            await dispatchEmail({
              kind: "subscription_receipt",
              to: lawyerUser.email,
              dedupeKey: `subscription_receipt:${paymentId}`,
              data: {
                lawyerName: lawyerUser.name,
                invoiceNumber: invoice.number,
                amountFormatted: formatPhp(amount),
                currency: invoice.currency,
                periodEndFormatted: formatDate(subscriptionPeriodEnd),
                subscriptionUrl: `${env().BETTER_AUTH_URL}/lawyer/subscribe`,
              },
            });
          }
        }
      } catch (err) {
        console.error("[email] subscription_receipt dispatch failed", paymentId, err);
      }
    } else if (invoice.clientId) {
      try {
        const clientUser = await conn.query.user.findFirst({
          where: eq(schema.user.id, invoice.clientId),
        });
        if (clientUser?.email) {
          await dispatchEmail({
            kind: "payment_receipt",
            to: clientUser.email,
            dedupeKey: `payment_receipt:${paymentId}`,
            data: {
              clientName: clientUser.name,
              invoiceNumber: invoice.number,
              amountPaidFormatted: formatPhp(amount),
              currency: invoice.currency,
              paidAtFormatted: formatDate(now),
              invoiceUrl: `${env().BETTER_AUTH_URL}/invoices/${invoice.id}`,
            },
          });
        }
      } catch (err) {
        console.error("[email] payment_receipt dispatch failed", paymentId, err);
      }
    }
  }

  return { idempotent: false, paymentId, status: input.status };
}

/**
 * Refund part or all of a successful payment. Writes a `refund` transaction
 * row (debit), bumps `payment.refundedCents`, flips the payment status to
 * `refunded` when fully refunded, and rolls back the invoice's `paidCents`
 * + status accordingly:
 *   paidCents - amount > 0  → partially_paid
 *   paidCents - amount === 0 → sent (re-payable)
 *
 * Caller (admin handler) is responsible for the audit log entry. This helper
 * is intentionally provider-agnostic — admin issues refunds directly today;
 * when real PayMongo/PayPal refunds land they'll call this AFTER the provider
 * acknowledges, and pass the provider refund id as `providerRefundId`.
 */
export async function refundPayment(input: {
  paymentId: string;
  amountCents: number;
  providerRefundId?: string;
  note?: string;
}) {
  const conn = db();

  const payment = await conn.query.payments.findFirst({
    where: eq(schema.payments.id, input.paymentId),
  });
  if (!payment) {
    throw new HTTPException(404, { message: "payment_not_found" });
  }
  if (payment.status !== "succeeded" && payment.status !== "refunded") {
    throw new HTTPException(409, { message: "payment_not_refundable" });
  }
  const remaining = payment.amountCents - payment.refundedCents;
  if (input.amountCents > remaining) {
    throw new HTTPException(409, { message: "refund_exceeds_remaining" });
  }
  if (input.amountCents <= 0) {
    throw new HTTPException(400, { message: "refund_amount_invalid" });
  }

  const invoice = await conn.query.invoices.findFirst({
    where: eq(schema.invoices.id, payment.invoiceId),
  });
  if (!invoice) {
    throw new HTTPException(404, { message: "invoice_not_found" });
  }

  const now = new Date();
  const newRefunded = payment.refundedCents + input.amountCents;
  const fullyRefunded = newRefunded >= payment.amountCents;

  await conn
    .update(schema.payments)
    .set({
      refundedCents: newRefunded,
      status: fullyRefunded ? "refunded" : payment.status,
      updatedAt: now,
    })
    .where(eq(schema.payments.id, payment.id));

  await conn.insert(schema.transactions).values({
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    paymentId: payment.id,
    kind: "refund",
    direction: "debit",
    amountCents: input.amountCents,
    currency: payment.currency,
    note: input.note ?? `Refund${input.providerRefundId ? ` ${input.providerRefundId}` : ""}`,
  });

  // Claw back the lawyer's earnings for the refunded portion. Reverse the NET
  // that was credited (gross - collection fee), pro-rata to refundedGross/gross.
  // Only applies to case invoices (subscription invoices never credited a balance).
  if (invoice.kind !== "subscription") {
    const feeLine = await conn.query.balanceEntries.findFirst({
      where: and(
        eq(schema.balanceEntries.relatedPaymentId, payment.id),
        eq(schema.balanceEntries.kind, "processing_fee"),
      ),
    });
    const reversal = refundReversalCents({
      grossCents: payment.amountCents,
      processingFeeCents: feeLine?.amountCents ?? 0,
      refundedGrossCents: input.amountCents,
    });
    if (reversal > 0) {
      await conn.insert(schema.balanceEntries).values({
        id: crypto.randomUUID(),
        lawyerId: invoice.lawyerId,
        kind: "refund_reversal",
        direction: "debit",
        amountCents: reversal,
        currency: payment.currency,
        clearsAt: now, // immediate — may drive available negative
        relatedPaymentId: payment.id,
        note: `Refund reversal for invoice ${invoice.number}`,
      });
    }
  }

  // Roll back the invoice paid total + status.
  const newPaid = Math.max(0, invoice.paidCents - input.amountCents);
  const nextStatus: "sent" | "partially_paid" | "paid" =
    newPaid <= 0 ? "sent" : newPaid < invoice.totalCents ? "partially_paid" : "paid";
  await conn
    .update(schema.invoices)
    .set({
      paidCents: newPaid,
      status: nextStatus,
      paidAt: nextStatus === "paid" ? invoice.paidAt : null,
      updatedAt: now,
    })
    .where(eq(schema.invoices.id, invoice.id));

  return {
    paymentId: payment.id,
    refundedCents: newRefunded,
    invoiceStatus: nextStatus,
    fullyRefunded,
  };
}

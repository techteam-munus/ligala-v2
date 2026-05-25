import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import {
  subscriptionCheckoutInput,
  subscriptionDiscountPreviewInput,
} from "@ligala/shared/schemas";
import { requireRole } from "../middleware/session";
import { newInvoiceNumber } from "../lib/billing";
import { recomputeInvoiceTotals } from "./billing";
import {
  lookupAdminSubscriptionCode,
  validateDiscountCodeForSubscription,
} from "../lib/subscription-discount";
import {
  SUBSCRIPTION_LINE_DESCRIPTION,
  daysUntil,
} from "../lib/subscription";
import {
  createCheckoutSession,
  PAYMONGO_MIN_AMOUNT_CENTS,
  PaymongoApiError,
  PaymongoUnreachableError,
} from "../lib/paymongo";
import { env } from "../lib/env";

function newId() {
  return crypto.randomUUID();
}

/**
 * Lawyer-self-service subscription. Mounted at `/lawyer/subscription`.
 *
 * GET /          — current state + daysRemaining
 * POST /checkout — create a subscription invoice, return a provider URL
 *
 * `requireRole("lawyer")` loads c.var.subscription as a side effect (see
 * middleware/session). The /checkout path is on the bypass list there, so
 * an expired lawyer can still call it to renew.
 */
export const subscriptions = new Hono()
  .use("*", requireRole("lawyer"))

  .get("/", async (c) => {
    const user = c.get("user");
    const sub = c.get("subscription");
    if (!sub) {
      // Defensive: every lawyer row is seeded at signup + by the migration
      // backfill. A missing row here is a data bug — surface it loudly so
      // we notice in logs rather than silently returning bogus dates.
      throw new HTTPException(500, { message: "subscription_missing" });
    }
    return c.json({
      subscription: {
        lawyerId: user.id,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt.toISOString(),
        currentPeriodEndsAt: sub.currentPeriodEndsAt.toISOString(),
        lastPaidAt: sub.lastPaidAt ? sub.lastPaidAt.toISOString() : null,
        priceCents: sub.priceCents,
        daysRemaining: daysUntil(sub.currentPeriodEndsAt),
      },
    });
  })

  .post(
    "/checkout",
    zValidator("json", subscriptionCheckoutInput),
    async (c) => {
      const user = c.get("user");
      const sub = c.get("subscription");
      if (!sub) {
        throw new HTTPException(500, { message: "subscription_missing" });
      }
      const { provider, discountCode } = c.req.valid("json");
      const conn = db();

      // Reuse the most recent unpaid `kind=subscription` invoice if one
      // exists — avoids accumulating orphan invoices from button-mash. A
      // settled invoice (status='paid') is left alone and a fresh one is
      // created. Multiple unpaid rows shouldn't happen post-this-change but
      // the `desc(createdAt)` + LIMIT-1 keeps it safe across older data.
      const existing = await conn.query.invoices.findFirst({
        where: and(
          eq(schema.invoices.lawyerId, user.id),
          eq(schema.invoices.kind, "subscription"),
          eq(schema.invoices.status, "sent"),
        ),
        orderBy: desc(schema.invoices.createdAt),
      });

      let invoice: typeof schema.invoices.$inferSelect;
      if (existing && existing.paidCents === 0) {
        invoice = existing;
      } else {
        let id = newId();
        let number = newInvoiceNumber();
        let created: typeof schema.invoices.$inferSelect | undefined;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const [row] = await conn
              .insert(schema.invoices)
              .values({
                id,
                number,
                kind: "subscription",
                caseId: null,
                engagementId: null,
                clientId: null,
                lawyerId: user.id,
                status: "sent",
                currency: "PHP",
                subtotalCents: sub.priceCents,
                totalCents: sub.priceCents,
                sentAt: new Date(),
              })
              .returning();
            created = row;
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes("number")) throw err;
            id = newId();
            number = newInvoiceNumber();
          }
        }
        if (!created) {
          throw new HTTPException(500, { message: "invoice_number_collision" });
        }
        invoice = created;

        await conn.insert(schema.invoiceLines).values({
          id: newId(),
          invoiceId: invoice.id,
          description: SUBSCRIPTION_LINE_DESCRIPTION,
          qtyThousandths: 1000,
          unitAmountCents: sub.priceCents,
          lineTotalCents: sub.priceCents,
          sortOrder: 0,
        });
      }

      // Apply (or clear) the discount code on each /checkout call so retries
      // with a different code overwrite a previous attempt on a reused
      // unpaid invoice. recomputeInvoiceTotals reads appliedDiscountCodeId
      // and re-derives subtotalCents/discountCents/totalCents from the lines.
      if (discountCode) {
        const codeRow = await lookupAdminSubscriptionCode(discountCode);
        if (!codeRow) {
          throw new HTTPException(409, { message: "code_not_found" });
        }
        const result = validateDiscountCodeForSubscription(
          codeRow,
          sub.priceCents,
          new Date(),
        );
        if (!result.ok) {
          throw new HTTPException(409, { message: result.error });
        }
        await conn
          .update(schema.invoices)
          .set({ appliedDiscountCodeId: codeRow.id, updatedAt: new Date() })
          .where(eq(schema.invoices.id, invoice.id));
      } else if (invoice.appliedDiscountCodeId) {
        await conn
          .update(schema.invoices)
          .set({ appliedDiscountCodeId: null, updatedAt: new Date() })
          .where(eq(schema.invoices.id, invoice.id));
      }
      await recomputeInvoiceTotals(invoice.id);
      const refreshed = await conn.query.invoices.findFirst({
        where: eq(schema.invoices.id, invoice.id),
      });
      if (!refreshed) {
        throw new HTTPException(500, { message: "invoice_missing_after_recompute" });
      }
      invoice = refreshed;

      if (provider === "paypal") {
        throw new HTTPException(501, { message: "paypal_not_enabled" });
      }

      if (provider === "paymongo") {
        const secretKey = env().PAYMONGO_SECRET_KEY;
        if (!secretKey) {
          console.warn("paymongo_not_configured: PAYMONGO_SECRET_KEY is unset");
          throw new HTTPException(501, { message: "paymongo_not_configured" });
        }
        if (invoice.totalCents < PAYMONGO_MIN_AMOUNT_CENTS) {
          throw new HTTPException(409, { message: "discount_total_too_low" });
        }
        const baseUrl = env().BETTER_AUTH_URL;
        try {
          const session = await createCheckoutSession({
            secretKey,
            amountCents: invoice.totalCents,
            currency: "PHP",
            lineDescription: SUBSCRIPTION_LINE_DESCRIPTION,
            successUrl: `${baseUrl}/lawyer/subscribe?status=success`,
            cancelUrl: `${baseUrl}/lawyer/subscribe?status=cancelled`,
            referenceNumber: invoice.id,
            metadata: { invoiceId: invoice.id, lawyerId: user.id },
            customerEmail: user.email,
          });
          return c.json({
            invoiceId: invoice.id,
            provider,
            providerPaymentId: session.sessionId,
            amountCents: invoice.totalCents,
            currency: "PHP",
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

      // provider === "dev_simulate": unchanged behavior, used by Playwright +
      // local hand-testing. PayMongo's minimum amount doesn't apply here so
      // 100% discounts work end-to-end in tests.
      const intentId = `pi_${provider}_${crypto.randomUUID().slice(0, 12)}`;
      const apiOrigin = c.req.url.split(c.req.path)[0];
      return c.json({
        invoiceId: invoice.id,
        provider,
        providerPaymentId: intentId,
        amountCents: invoice.totalCents,
        currency: "PHP",
        checkoutUrl: `${apiOrigin}/billing/dev/simulate-payment?invoiceId=${invoice.id}&providerPaymentId=${intentId}&provider=${provider}`,
      });
    },
  )

  // Preview a discount code against the lawyer's current subscription price
  // without creating or touching any invoice. Used by the Apply button on
  // /lawyer/subscribe so the user sees the discounted total before paying.
  // Runs the same validation rules as /checkout (including the PayMongo
  // minimum) so a code that previews OK will also subscribe OK.
  .post(
    "/discount/preview",
    zValidator("json", subscriptionDiscountPreviewInput),
    async (c) => {
      const sub = c.get("subscription");
      if (!sub) {
        throw new HTTPException(500, { message: "subscription_missing" });
      }
      const { code } = c.req.valid("json");
      const codeRow = await lookupAdminSubscriptionCode(code);
      if (!codeRow) {
        throw new HTTPException(409, { message: "code_not_found" });
      }
      const result = validateDiscountCodeForSubscription(
        codeRow,
        sub.priceCents,
        new Date(),
      );
      if (!result.ok) {
        throw new HTTPException(409, { message: result.error });
      }
      const totalCents = sub.priceCents - result.discountCents;
      if (totalCents < PAYMONGO_MIN_AMOUNT_CENTS) {
        throw new HTTPException(409, { message: "discount_total_too_low" });
      }
      return c.json({
        code: codeRow.code,
        kind: codeRow.kind,
        discountCents: result.discountCents,
        originalCents: sub.priceCents,
        totalCents,
      });
    },
  );

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { subscriptionCheckoutInput } from "@ligala/shared/schemas";
import { requireRole } from "../middleware/session";
import { newInvoiceNumber } from "../lib/billing";
import {
  SUBSCRIPTION_LINE_DESCRIPTION,
  daysUntil,
} from "../lib/subscription";
import {
  createCheckoutSession,
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
      const { provider } = c.req.valid("json");
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

      if (provider === "paypal") {
        throw new HTTPException(501, { message: "paypal_not_enabled" });
      }

      if (provider === "paymongo") {
        const secretKey = env().PAYMONGO_SECRET_KEY;
        if (!secretKey) {
          throw new HTTPException(501, { message: "paymongo_not_configured" });
        }
        const baseUrl = env().BETTER_AUTH_URL;
        try {
          const session = await createCheckoutSession({
            secretKey,
            amountCents: sub.priceCents,
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
            amountCents: sub.priceCents,
            currency: "PHP",
            checkoutUrl: session.checkoutUrl,
          });
        } catch (err) {
          if (err instanceof PaymongoApiError) {
            console.error("paymongo_request_failed", err.status, err.bodyText);
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
      // local hand-testing.
      const intentId = `pi_${provider}_${crypto.randomUUID().slice(0, 12)}`;
      const apiOrigin = c.req.url.split(c.req.path)[0];
      return c.json({
        invoiceId: invoice.id,
        provider,
        providerPaymentId: intentId,
        amountCents: sub.priceCents,
        currency: "PHP",
        checkoutUrl: `${apiOrigin}/billing/dev/simulate-payment?invoiceId=${invoice.id}&providerPaymentId=${intentId}&provider=${provider}`,
      });
    },
  );

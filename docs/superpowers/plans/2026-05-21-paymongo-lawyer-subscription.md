# PayMongo lawyer subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dev-simulate-only Subscribe button on `/lawyer/subscribe` with a real PayMongo Checkout Session flow that charges ₱999, redirects through PayMongo's hosted page, and receives a signature-verified webhook back into the existing `applyPaymentWebhook` helper.

**Architecture:** New `apps/api/src/lib/paymongo.ts` houses the provider client (`createCheckoutSession`, `verifyWebhookSignature`) as pure functions, unit-tested against mocked `fetch`. `POST /lawyer/subscription/checkout` branches on `provider`: `paymongo` calls `createCheckoutSession`, `dev_simulate` is preserved for local/Playwright testing, `paypal` returns 501. `/webhooks/paymongo` is rewritten to read the raw body, verify the `Paymongo-Signature` header, translate the provider payload to the existing normalized `paymentWebhookInput`, and call `applyPaymentWebhook` (unchanged). The web button does a `window.location.assign` redirect; the success page polls `GET /lawyer/subscription` for up to 10s to handle the webhook-races-the-redirect case.

**Tech Stack:** TypeScript, Hono (api), Next 15 App Router (web), Drizzle ORM, vitest, PayMongo v1 REST API (Checkout Sessions), Node `crypto.createHmac` + `crypto.timingSafeEqual`.

**Reference spec:** `docs/superpowers/specs/2026-05-21-paymongo-lawyer-subscription-design.md`

---

## Pre-flight

Read the spec end-to-end before starting Task 1. It describes the data flow, idempotency invariants, and error-handling table that the code below enforces. The plan does not repeat the rationale — the spec is the source of truth for "why."

Also read these files for context (do NOT modify them in this plan):
- `apps/api/src/routes/billing.ts` — `applyPaymentWebhook` (provider-agnostic; we call it unchanged) and the existing dev `simulate-payment` endpoint
- `apps/api/src/middleware/session.ts` — `requireRole("lawyer")` and the `SUBSCRIPTION_BYPASS_PATHS` carve-out
- `apps/api/src/lib/subscription.ts` — `SUBSCRIPTION_PRICE_CENTS`, `SUBSCRIPTION_LINE_DESCRIPTION`
- `packages/shared/src/schemas/subscriptions.ts` — `subscriptionCheckoutInput`
- `packages/shared/src/schemas/billing.ts` — `paymentWebhookInput` (the normalized shape we translate to)

---

## File Structure

**New files**
- `apps/api/src/lib/paymongo.ts` — provider client (exports `createCheckoutSession`, `verifyWebhookSignature`, error types). Pure functions. No Hono coupling.
- `apps/api/src/lib/paymongo.test.ts` — unit tests with mocked `fetch`.
- `apps/web/app/(lawyer)/lawyer/subscribe/_components/payment-status-banner.tsx` — small client component that reads `status` from URL and polls `GET /lawyer/subscription` when `status=success`.

**Modified files**
- `apps/api/src/lib/env.ts` — register `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` as optional.
- `apps/api/src/routes/subscriptions.ts` — `/checkout` route branches on `provider`.
- `apps/api/src/routes/webhooks.ts` — `/paymongo` route rewritten: raw body + signature verify + translate + call `applyPaymentWebhook`.
- `apps/web/app/(lawyer)/lawyer/subscribe/subscribe-button.tsx` — `window.location.assign(checkoutUrl)` for `paymongo`; preserve `dev_simulate` POST path for `NODE_ENV !== "production"` + `?simulate=1`.
- `apps/web/app/(lawyer)/lawyer/subscribe/page.tsx` — render `PaymentStatusBanner` above the price card.

**Files explicitly unchanged**
- `apps/api/src/routes/billing.ts` (`applyPaymentWebhook`).
- `packages/shared/src/schemas/billing.ts` and `packages/shared/src/schemas/subscriptions.ts`.
- `workers/paymongo/handler.ts` (stays a stub; SQS path is a future phase).
- Drizzle schema — no migration needed.

---

## Task 1: PayMongo client library (TDD)

This task introduces the first vitest-driven test file in `apps/api`. `apps/api/package.json` already declares `"test": "vitest run"` and vitest is in devDependencies — no config file is needed; defaults pick up `*.test.ts` next to source.

**Files:**
- Create: `apps/api/src/lib/paymongo.ts`
- Create: `apps/api/src/lib/paymongo.test.ts`

- [ ] **Step 1: Write the failing test file for `verifyWebhookSignature`**

Create `apps/api/src/lib/paymongo.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  createCheckoutSession,
  verifyWebhookSignature,
  PaymongoApiError,
  PaymongoUnreachableError,
  PaymongoSignatureError,
} from "./paymongo";

const SECRET = "whsk_test_abc123";

function sign(rawBody: string, ts: number, secret = SECRET): string {
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return `t=${ts},te=${sig},li=${sig}`;
}

describe("verifyWebhookSignature", () => {
  it("returns the parsed event when the signature matches", () => {
    const body = JSON.stringify({ data: { attributes: { type: "payment.paid" } } });
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(body, ts);
    const event = verifyWebhookSignature(body, header, SECRET);
    expect(event.data.attributes.type).toBe("payment.paid");
  });

  it("throws PaymongoSignatureError on missing header", () => {
    expect(() => verifyWebhookSignature("{}", undefined, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws on malformed header (missing t=)", () => {
    expect(() => verifyWebhookSignature("{}", "te=abc,li=def", SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws on tampered body", () => {
    const body = JSON.stringify({ data: { attributes: { type: "payment.paid" } } });
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(body, ts);
    expect(() => verifyWebhookSignature(body + "x", header, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws on wrong secret", () => {
    const body = "{}";
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(body, ts, "whsk_wrong");
    expect(() => verifyWebhookSignature(body, header, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws when both te and li are missing", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() => verifyWebhookSignature("{}", `t=${ts}`, SECRET)).toThrow(PaymongoSignatureError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails with "module not found"**

Run: `pnpm --filter @ligala/api test -- paymongo`

Expected: All tests fail because `./paymongo` doesn't exist yet.

- [ ] **Step 3: Implement `paymongo.ts` minimally to make signature tests pass**

Create `apps/api/src/lib/paymongo.ts`:

```ts
import crypto from "node:crypto";

export type PaymongoEvent = {
  data: {
    id: string;
    type: "event";
    attributes: {
      type: string;
      livemode: boolean;
      data: {
        id: string;
        attributes: {
          metadata?: Record<string, string>;
          reference_number?: string;
          total_amount?: number;
          amount?: number;
          last_payment_error?: { message?: string } | null;
          [key: string]: unknown;
        };
      };
    };
  };
};

export class PaymongoSignatureError extends Error {
  constructor(reason: string) {
    super(`paymongo_signature_invalid: ${reason}`);
    this.name = "PaymongoSignatureError";
  }
}

export class PaymongoApiError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(`paymongo_api_error_${status}`);
    this.name = "PaymongoApiError";
  }
}

export class PaymongoUnreachableError extends Error {
  constructor(cause: unknown) {
    super("paymongo_unreachable");
    this.name = "PaymongoUnreachableError";
    this.cause = cause;
  }
}

function parseSignatureHeader(header: string): { t: string; te?: string; li?: string } {
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  if (!out.t) throw new PaymongoSignatureError("missing t");
  return { t: out.t, te: out.te, li: out.li };
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyWebhookSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): PaymongoEvent {
  if (!header) throw new PaymongoSignatureError("no header");
  const { t, te, li } = parseSignatureHeader(header);
  if (!te && !li) throw new PaymongoSignatureError("no te or li");

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const okTest = te ? constantTimeEqualHex(te, expected) : false;
  const okLive = li ? constantTimeEqualHex(li, expected) : false;
  if (!okTest && !okLive) throw new PaymongoSignatureError("mismatch");

  try {
    return JSON.parse(rawBody) as PaymongoEvent;
  } catch {
    throw new PaymongoSignatureError("body_not_json");
  }
}

// createCheckoutSession is implemented in the next step; throw for now so its
// tests fail with a clear message rather than a TypeError.
export async function createCheckoutSession(_: never): Promise<never> {
  throw new Error("not_implemented");
}
```

- [ ] **Step 4: Run signature tests and verify they pass**

Run: `pnpm --filter @ligala/api test -- paymongo`

Expected: 6 signature tests pass. `createCheckoutSession` tests don't exist yet.

- [ ] **Step 5: Add failing tests for `createCheckoutSession`**

Append to `apps/api/src/lib/paymongo.test.ts`:

```ts
describe("createCheckoutSession", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  const VALID_OK_RESPONSE = {
    data: {
      id: "cs_test_xxx",
      type: "checkout_session",
      attributes: { checkout_url: "https://checkout.paymongo.com/cs_test_xxx" },
    },
  };

  function mockFetchOnce(body: unknown, init: { status?: number } = {}) {
    const fn = vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it("posts a correctly-shaped request and returns sessionId + checkoutUrl", async () => {
    const fetchMock = mockFetchOnce(VALID_OK_RESPONSE);
    const result = await createCheckoutSession({
      secretKey: "sk_test_keyvalue",
      amountCents: 99900,
      currency: "PHP",
      lineDescription: "Ligala — Monthly subscription",
      successUrl: "http://localhost:3000/lawyer/subscribe?status=success",
      cancelUrl: "http://localhost:3000/lawyer/subscribe?status=cancelled",
      referenceNumber: "inv_abc",
      metadata: { invoiceId: "inv_abc", lawyerId: "usr_123" },
      customerEmail: "lawyer@example.test",
    });

    expect(result).toEqual({
      sessionId: "cs_test_xxx",
      checkoutUrl: "https://checkout.paymongo.com/cs_test_xxx",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.paymongo.com/v1/checkout_sessions");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe(
      `Basic ${Buffer.from("sk_test_keyvalue:").toString("base64")}`,
    );
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.data.attributes.line_items).toEqual([
      {
        amount: 99900,
        currency: "PHP",
        name: "Ligala — Monthly subscription",
        quantity: 1,
      },
    ]);
    expect(body.data.attributes.success_url).toBe(
      "http://localhost:3000/lawyer/subscribe?status=success",
    );
    expect(body.data.attributes.cancel_url).toBe(
      "http://localhost:3000/lawyer/subscribe?status=cancelled",
    );
    expect(body.data.attributes.reference_number).toBe("inv_abc");
    expect(body.data.attributes.metadata).toEqual({
      invoiceId: "inv_abc",
      lawyerId: "usr_123",
    });
    expect(body.data.attributes.billing?.email).toBe("lawyer@example.test");
    expect(body.data.attributes.send_email_receipt).toBe(true);
  });

  it("throws PaymongoApiError on non-2xx response", async () => {
    mockFetchOnce({ errors: [{ code: "parameter_required" }] }, { status: 400 });
    await expect(
      createCheckoutSession({
        secretKey: "sk_test_x",
        amountCents: 99900,
        currency: "PHP",
        lineDescription: "x",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
        referenceNumber: "r",
        metadata: { invoiceId: "r", lawyerId: "l" },
      }),
    ).rejects.toBeInstanceOf(PaymongoApiError);
  });

  it("throws PaymongoUnreachableError when fetch throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(
      createCheckoutSession({
        secretKey: "sk_test_x",
        amountCents: 99900,
        currency: "PHP",
        lineDescription: "x",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
        referenceNumber: "r",
        metadata: { invoiceId: "r", lawyerId: "l" },
      }),
    ).rejects.toBeInstanceOf(PaymongoUnreachableError);
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter @ligala/api test -- paymongo`

Expected: 3 new `createCheckoutSession` tests fail (the placeholder throws "not_implemented").

- [ ] **Step 7: Implement `createCheckoutSession`**

In `apps/api/src/lib/paymongo.ts`, replace the placeholder `createCheckoutSession` export with:

```ts
export type CreateCheckoutSessionInput = {
  secretKey: string;
  amountCents: number;
  currency: "PHP";
  lineDescription: string;
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string;
  metadata: { invoiceId: string; lawyerId: string };
  customerEmail?: string;
};

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ sessionId: string; checkoutUrl: string }> {
  const body = {
    data: {
      attributes: {
        line_items: [
          {
            amount: input.amountCents,
            currency: input.currency,
            name: input.lineDescription,
            quantity: 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference_number: input.referenceNumber,
        metadata: input.metadata,
        send_email_receipt: true,
        description: input.lineDescription,
        ...(input.customerEmail
          ? { billing: { email: input.customerEmail } }
          : {}),
      },
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${input.secretKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new PaymongoUnreachableError(err);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new PaymongoApiError(res.status, text);
  }

  let parsed: {
    data: { id: string; attributes: { checkout_url: string } };
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PaymongoApiError(res.status, text);
  }

  return {
    sessionId: parsed.data.id,
    checkoutUrl: parsed.data.attributes.checkout_url,
  };
}
```

- [ ] **Step 8: Run the test suite and verify all 9 tests pass**

Run: `pnpm --filter @ligala/api test -- paymongo`

Expected: 9 tests pass (6 signature + 3 createCheckoutSession).

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/lib/paymongo.ts apps/api/src/lib/paymongo.test.ts
git commit -m "feat(api): add PayMongo client (checkout sessions + webhook signature verify)"
```

---

## Task 2: Register PayMongo env vars

**Files:**
- Modify: `apps/api/src/lib/env.ts`

- [ ] **Step 1: Add `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` to the env schema**

In `apps/api/src/lib/env.ts`, replace the schema block with:

```ts
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  AWS_REGION: z.string().default("ap-southeast-1"),
  S3_UPLOADS_BUCKET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
});
```

The rest of the file (the `cached` block, `env()` function) stays unchanged.

- [ ] **Step 2: Typecheck and confirm `apps/api` still boots clean**

Run: `pnpm --filter @ligala/api typecheck`

Expected: no errors. `env()` callers (e.g. `lib/sentry.ts`, anything referencing `env.SENTRY_DSN`) keep working because we only added optional fields.

- [ ] **Step 3: Verify `.env.example` already lists both keys**

Run: `grep -E 'PAYMONGO_(SECRET_KEY|WEBHOOK_SECRET)' .env.example`

Expected: both lines present (they already are).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/env.ts
git commit -m "feat(api): register PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET in env schema"
```

---

## Task 3: Branch `/lawyer/subscription/checkout` on provider

**Files:**
- Modify: `apps/api/src/routes/subscriptions.ts`

- [ ] **Step 1: Add the imports needed for the new branches**

In `apps/api/src/routes/subscriptions.ts`, replace the top-of-file import block with:

```ts
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
```

- [ ] **Step 2: Replace the checkout response block to branch on provider**

In `apps/api/src/routes/subscriptions.ts`, find this block at the end of the `.post("/checkout", ...)` handler:

```ts
      // Real PayMongo / PayPal integration returns a hosted checkout URL;
      // dev returns the in-house simulate page (same shape used by the
      // existing invoice checkout flow at /billing/invoices/:id/checkout).
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
```

Replace it with:

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`

Expected: no errors.

- [ ] **Step 4: Manual smoke — `provider=paypal` returns 501**

Start the api: `pnpm dev` (in a separate terminal if not already running).

Sign in as a seeded lawyer in a browser, copy the `ligala.session_token` cookie value, then in your shell:

```bash
curl -i -X POST http://localhost:8787/lawyer/subscription/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: ligala.session_token=<PASTE>" \
  -d '{"provider":"paypal"}'
```

Expected: HTTP 501 with body `{"error":"paypal_not_enabled", ...}` (exact error shape depends on the existing `errorHandler` middleware).

- [ ] **Step 5: Manual smoke — `provider=paymongo` with no key returns 501**

Temporarily ensure `PAYMONGO_SECRET_KEY` is unset in `apps/api/.env.local`. Then:

```bash
curl -i -X POST http://localhost:8787/lawyer/subscription/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: ligala.session_token=<PASTE>" \
  -d '{"provider":"paymongo"}'
```

Expected: HTTP 501 with body containing `paymongo_not_configured`.

- [ ] **Step 6: Manual smoke — `provider=paymongo` with sandbox key returns a real `checkout_url`**

Add `PAYMONGO_SECRET_KEY=sk_test_xxx` to `apps/api/.env.local` (use your sandbox key). Restart `pnpm dev`. Then:

```bash
curl -i -X POST http://localhost:8787/lawyer/subscription/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: ligala.session_token=<PASTE>" \
  -d '{"provider":"paymongo"}'
```

Expected: HTTP 200 with body like `{"invoiceId":"...","provider":"paymongo","providerPaymentId":"cs_test_...","amountCents":99900,"currency":"PHP","checkoutUrl":"https://checkout.paymongo.com/..."}`. Open the `checkoutUrl` in a browser — PayMongo's sandbox checkout page should load with ₱999.00 displayed.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/subscriptions.ts
git commit -m "feat(api): create a real PayMongo Checkout Session for lawyer subscription"
```

---

## Task 4: Verify `/webhooks/paymongo` signature + translate to `applyPaymentWebhook`

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts`

- [ ] **Step 1: Rewrite the `/paymongo` handler**

In `apps/api/src/routes/webhooks.ts`, replace the entire `.post("/paymongo", async (c) => { ... })` block with:

```ts
  /**
   * PayMongo webhook. Reads the raw body for HMAC verification, then translates
   * `checkout_session.payment.paid` / `payment.paid` / `payment.failed` into the
   * normalized `applyPaymentWebhook` shape. Any other event type is acknowledged
   * (200) but not processed, so PayMongo doesn't retry events we don't care
   * about. Unknown invoiceId is also 200-acknowledged (with an error log) to
   * avoid a permanent retry loop on a misconfigured metadata field.
   */
  .post("/paymongo", async (c) => {
    const secret = env().PAYMONGO_WEBHOOK_SECRET;
    if (!secret) {
      return c.json({ error: "paymongo_webhook_not_configured" }, 501);
    }
    const raw = await c.req.raw.text();
    const header = c.req.header("Paymongo-Signature");

    let event: PaymongoEvent;
    try {
      event = verifyWebhookSignature(raw, header, secret);
    } catch (err) {
      console.warn("paymongo_webhook_signature_invalid", err);
      return c.json({ error: "invalid_signature" }, 401);
    }

    const type = event.data.attributes.type;
    if (
      type !== "checkout_session.payment.paid" &&
      type !== "payment.paid" &&
      type !== "payment.failed"
    ) {
      return c.json({ ignored: true, type });
    }

    const resource = event.data.attributes.data;
    const metadata = resource.attributes.metadata ?? {};
    const invoiceId = metadata.invoiceId;
    if (!invoiceId) {
      console.error("paymongo_webhook_missing_invoice_id", { type, resourceId: resource.id });
      return c.json({ ignored: true, reason: "no_invoice_id" });
    }

    const providerPaymentId = resource.id;
    const amountCents =
      typeof resource.attributes.total_amount === "number"
        ? resource.attributes.total_amount
        : typeof resource.attributes.amount === "number"
          ? resource.attributes.amount
          : 0;
    const status: "succeeded" | "failed" =
      type === "payment.failed" ? "failed" : "succeeded";
    const failureReason =
      type === "payment.failed"
        ? resource.attributes.last_payment_error?.message
        : undefined;

    const result = await applyPaymentWebhook({
      provider: "paymongo",
      providerPaymentId,
      invoiceId,
      status,
      amountCents,
      currency: "PHP",
      failureReason,
      rawPayload: event,
    });
    return c.json(result);
  })
```

- [ ] **Step 2: Update the imports at the top of `webhooks.ts`**

Replace the import block with:

```ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { idmetaWebhookPayload, paymentWebhookInput } from "@ligala/shared/schemas";
import { applyPaymentWebhook } from "./billing";
import {
  verifyWebhookSignature,
  type PaymongoEvent,
} from "../lib/paymongo";
import { env } from "../lib/env";
```

Note: `paymentWebhookInput` is still imported because the `/paypal` route below still uses it. Don't delete it.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`

Expected: no errors.

- [ ] **Step 4: Manual smoke — bad signature returns 401**

Ensure `PAYMONGO_WEBHOOK_SECRET=whsk_test_anything` is set in `apps/api/.env.local`. Restart `pnpm dev`. Then:

```bash
curl -i -X POST http://localhost:8787/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -H "Paymongo-Signature: t=1,te=deadbeef,li=deadbeef" \
  -d '{}'
```

Expected: HTTP 401 with body `{"error":"invalid_signature"}`.

- [ ] **Step 5: Manual smoke — missing header returns 401**

```bash
curl -i -X POST http://localhost:8787/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: HTTP 401.

- [ ] **Step 6: Manual smoke — unsigned secret missing returns 501**

Temporarily comment out `PAYMONGO_WEBHOOK_SECRET` in `.env.local`, restart, hit the endpoint. Expected: 501 `paymongo_webhook_not_configured`. Restore the env var afterwards.

- [ ] **Step 7: Manual smoke — well-formed signed payload extends the period**

Get the current `currentPeriodEndsAt` for a seeded test lawyer via `pnpm db:studio` (table: `lawyer_subscriptions`). Note it.

Create a script `/tmp/sign-webhook.mjs`:

```js
import crypto from "node:crypto";

const SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;
if (!SECRET) throw new Error("set PAYMONGO_WEBHOOK_SECRET in env");

const invoiceId = process.argv[2];
if (!invoiceId) throw new Error("usage: node sign-webhook.mjs <invoiceId>");

const body = JSON.stringify({
  data: {
    id: "evt_test_1",
    type: "event",
    attributes: {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: {
        id: `cs_test_${crypto.randomUUID().slice(0, 8)}`,
        attributes: {
          metadata: { invoiceId, lawyerId: "ignored_here" },
          total_amount: 99900,
        },
      },
    },
  },
});
const ts = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex");

console.log("HEADER:", `t=${ts},te=${sig},li=${sig}`);
console.log("BODY:", body);
```

Find the lawyer's current open subscription invoice via `pnpm db:studio` (table: `invoices`, `kind='subscription'`, `status='sent'`, your lawyer's `lawyer_id`). Note the `id`.

Run:

```bash
node /tmp/sign-webhook.mjs <invoiceId>
```

Take the HEADER and BODY output and POST them:

```bash
curl -i -X POST http://localhost:8787/webhooks/paymongo \
  -H "Content-Type: application/json" \
  -H "Paymongo-Signature: <HEADER>" \
  -d '<BODY>'
```

Expected: HTTP 200 with body `{"idempotent":false,"paymentId":"...","status":"succeeded"}`. In `pnpm db:studio`:
- `payments` table has a new row with `provider='paymongo'`, `status='succeeded'`, `amount_cents=99900`.
- `transactions` table has a new row with `kind='charge'`, `direction='credit'`.
- `lawyer_subscriptions.current_period_ends_at` for that lawyer advanced by 30 days.
- `invoices` row for that invoice has `status='paid'`, `paid_cents=99900`.

Re-POST the same request. Expected: HTTP 200 with `{"idempotent":true, ...}` — no double extension.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/webhooks.ts
git commit -m "feat(api): verify PayMongo webhook signature and translate to applyPaymentWebhook"
```

---

## Task 5: Web button — redirect to PayMongo (preserve `dev_simulate` for local)

**Files:**
- Modify: `apps/web/app/(lawyer)/lawyer/subscribe/subscribe-button.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startSubscriptionCheckout } from "@/lib/actions/subscriptions";

/**
 * Real subscribe button. In production we always use PayMongo: we ask the api
 * for a hosted checkout URL and full-redirect to it. PayMongo handles
 * card / GCash / Maya / GrabPay and posts a signed webhook back to
 * /webhooks/paymongo on completion.
 *
 * The `dev_simulate` POST-and-refresh path is preserved when
 * `NODE_ENV !== "production"` AND the URL has `?simulate=1`, so Playwright
 * (which runs against `next dev`) can still drive the flow without hitting
 * PayMongo. Real lawyers never see this code path.
 */
export function SubscribeButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    setError(null);
    start(async () => {
      try {
        const simulate =
          process.env.NODE_ENV !== "production" &&
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("simulate") === "1";

        if (simulate) {
          const res = await startSubscriptionCheckout("dev_simulate");
          const r = await fetch(res.checkoutUrl, {
            method: "POST",
            credentials: "include",
          });
          if (!r.ok) throw new Error(`payment_failed (${r.status})`);
          router.refresh();
          return;
        }

        const res = await startSubscriptionCheckout("paymongo");
        window.location.assign(res.checkoutUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div>
      <Button type="button" disabled={pending} onClick={subscribe}>
        {pending ? "Processing…" : label}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: no errors.

- [ ] **Step 3: Manual smoke — clicking Subscribe redirects to PayMongo**

In the browser, sign in as a seeded lawyer, navigate to `/lawyer/subscribe`, click Subscribe.

Expected: the browser navigates to `https://checkout.paymongo.com/...` (PayMongo's hosted page). Don't complete the payment yet — that's Task 7.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(lawyer)/lawyer/subscribe/subscribe-button.tsx"
git commit -m "feat(web): redirect to PayMongo checkout (keep dev_simulate behind ?simulate=1)"
```

---

## Task 6: Web page — success/cancel banner with polling

**Files:**
- Create: `apps/web/app/(lawyer)/lawyer/subscribe/_components/payment-status-banner.tsx`
- Modify: `apps/web/app/(lawyer)/lawyer/subscribe/page.tsx`

- [ ] **Step 1: Create the banner client component**

Create `apps/web/app/(lawyer)/lawyer/subscribe/_components/payment-status-banner.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  status: "success" | "cancelled";
  /** ISO string from server render — used as the baseline; once a poll sees a newer value, we know the webhook landed. */
  initialLastPaidAt: string | null;
};

/**
 * Renders the post-redirect status banner above the price card on
 * /lawyer/subscribe.
 *
 * `success` → "Processing your payment…" while we wait for the webhook;
 *   polls GET /lawyer/subscription every 2s for up to 10s. When `lastPaidAt`
 *   advances past the value we saw at server render time, we trigger
 *   router.refresh() so the rest of the page (price card, period end date)
 *   re-renders from the new server state, and we switch the copy to
 *   "Payment received".
 *
 * `cancelled` → muted "Payment cancelled" line; no polling.
 */
export function PaymentStatusBanner({ status, initialLastPaidAt }: Props) {
  const router = useRouter();
  const [resolved, setResolved] = useState(false);
  const baseline = useRef(initialLastPaidAt);

  useEffect(() => {
    if (status !== "success" || resolved) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const r = await fetch("/api/lawyer-subscription-snapshot", {
          credentials: "include",
        });
        if (r.ok) {
          const data = (await r.json()) as { lastPaidAt: string | null };
          if (data.lastPaidAt && data.lastPaidAt !== baseline.current) {
            if (!cancelled) {
              setResolved(true);
              router.refresh();
            }
            return;
          }
        }
      } catch {
        // ignore; we'll retry
      }
      if (attempts < 5 && !cancelled) setTimeout(tick, 2_000);
    };
    const id = setTimeout(tick, 2_000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [status, resolved, router]);

  if (status === "cancelled") {
    return (
      <div className="mb-6 rounded-md border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
        Payment cancelled. You can try again anytime.
      </div>
    );
  }

  if (resolved) {
    return (
      <div className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
        Payment received — your subscription is active.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
      Processing your payment… this usually takes a few seconds.
    </div>
  );
}
```

- [ ] **Step 2: Add the snapshot proxy route**

The banner polls `/api/lawyer-subscription-snapshot` because client components can't forward the session cookie to the api host directly the way Server Components/Actions do (CORS + origin). The simplest path is a tiny Next route that proxies through `apps/web/lib/api.ts` (which forwards cookies). Create `apps/web/app/api/lawyer-subscription-snapshot/route.ts`:

```ts
import { NextResponse } from "next/server";
import { api } from "@/lib/api";

type SubscriptionDto = {
  lastPaidAt: string | null;
};

export async function GET() {
  try {
    const { subscription } = await api<{ subscription: SubscriptionDto }>(
      "/lawyer/subscription",
    );
    return NextResponse.json({ lastPaidAt: subscription.lastPaidAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Mount the banner in the subscribe page**

In `apps/web/app/(lawyer)/lawyer/subscribe/page.tsx`, replace the entire file with:

```tsx
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscribeButton } from "./subscribe-button";
import { PaymentStatusBanner } from "./_components/payment-status-banner";

type SubscriptionDto = {
  lawyerId: string;
  status: "trialing" | "active" | "past_due";
  trialEndsAt: string;
  currentPeriodEndsAt: string;
  lastPaidAt: string | null;
  priceCents: number;
  daysRemaining: number;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subscription } = await api<{ subscription: SubscriptionDto }>(
    "/lawyer/subscription",
  );
  const expired = subscription.daysRemaining < 0;
  const price = money(subscription.priceCents);
  const sp = await searchParams;
  const arrivedFromBlock = sp.from === "expired";
  const status =
    sp.status === "success" || sp.status === "cancelled" ? sp.status : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Subscription</h1>
      <p className="mt-2 text-muted-foreground">
        {arrivedFromBlock
          ? "We couldn’t complete that action because your subscription has lapsed. Subscribe to continue."
          : subscription.status === "trialing"
            ? "You’re on a free trial of Ligala for lawyers."
            : subscription.status === "active"
              ? "Your Ligala subscription is active."
              : "Your subscription has lapsed."}
      </p>

      {status ? (
        <div className="mt-6">
          <PaymentStatusBanner
            status={status}
            initialLastPaidAt={subscription.lastPaidAt}
          />
        </div>
      ) : null}

      <Card className="mt-8 gap-3 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-xl">
            {price}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / month
            </span>
          </CardTitle>
          <CardDescription>
            {expired ? (
              <>
                Your access lapsed on{" "}
                <strong>{formatDate(subscription.currentPeriodEndsAt)}</strong>.
                Subscribe to resume creating cases, sending invoices, and the
                rest.
              </>
            ) : subscription.status === "trialing" ? (
              <>
                {subscription.daysRemaining} day
                {subscription.daysRemaining === 1 ? "" : "s"} left in trial —
                ends {formatDate(subscription.currentPeriodEndsAt)}.
              </>
            ) : (
              <>
                Renews on{" "}
                <strong>{formatDate(subscription.currentPeriodEndsAt)}</strong>.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <SubscribeButton
            label={
              expired
                ? `Subscribe (${price} / mo)`
                : subscription.status === "trialing"
                  ? `Subscribe now (${price} / mo)`
                  : `Renew early (${price} / mo)`
            }
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Each payment extends your access by 30 days. No auto-renewal — pay
            again when you&apos;re ready.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: no errors.

- [ ] **Step 5: Manual smoke — banners render with the right copy**

With `pnpm dev` running, in the browser:

1. Sign in as a seeded lawyer, navigate to `/lawyer/subscribe?status=cancelled`. Expected: muted "Payment cancelled" banner above the price card.
2. Navigate to `/lawyer/subscribe?status=success`. Expected: green "Processing your payment…" banner. After ~10s it stays in that state because no webhook arrives — that's the correct dead-end behavior for a manual URL hit.
3. Navigate to `/lawyer/subscribe` (no query). Expected: no banner.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(lawyer)/lawyer/subscribe/_components/payment-status-banner.tsx" \
        "apps/web/app/api/lawyer-subscription-snapshot/route.ts" \
        "apps/web/app/(lawyer)/lawyer/subscribe/page.tsx"
git commit -m "feat(web): payment status banner with poll-for-webhook-arrival on success"
```

---

## Task 7: End-to-end sandbox verification

This is a one-time human verification step. It exercises the entire flow against PayMongo's sandbox, proves the webhook → DB write chain works, and confirms the success page transitions correctly.

**Prerequisites:**
- A PayMongo sandbox account.
- `PAYMONGO_SECRET_KEY=sk_test_xxx` in `apps/api/.env.local`.
- A public tunnel (ngrok / Cloudflare Tunnel) pointing at `:8787` (the api).

- [ ] **Step 1: Register the webhook with PayMongo sandbox**

Get your tunnel URL — call it `TUNNEL` (e.g., `https://abc123.ngrok.app`). The api is reachable at `${TUNNEL}/webhooks/paymongo`.

```bash
curl -X POST https://api.paymongo.com/v1/webhooks \
  -u "sk_test_xxx:" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "attributes": {
        "url": "https://<TUNNEL>/webhooks/paymongo",
        "events": [
          "checkout_session.payment.paid",
          "payment.paid",
          "payment.failed"
        ]
      }
    }
  }'
```

Expected: 200 response with `data.attributes.secret_key` starting with `whsk_`. Copy that value.

- [ ] **Step 2: Configure the webhook secret**

Put `PAYMONGO_WEBHOOK_SECRET=whsk_xxx` (the value from Step 1) into `apps/api/.env.local`. Restart `pnpm dev`.

- [ ] **Step 3: Run the golden-path payment**

1. In a browser, sign in as a seeded lawyer.
2. Open `pnpm db:studio` in another tab; navigate to `lawyer_subscriptions` and note the current `current_period_ends_at` for this lawyer. Also open `invoices` and `payments` and note the current row counts for this lawyer.
3. Navigate to `/lawyer/subscribe`. Click Subscribe.
4. Confirm the browser lands on `checkout.paymongo.com`. Pay with PayMongo's test card: `4343 4343 4343 4345`, any future expiry, any 3-digit CVC, any name. Complete any 3DS challenge with the test OTP `123456`.
5. PayMongo redirects back to `/lawyer/subscribe?status=success`. The banner shows "Processing your payment…". Within ~5s it should switch to "Payment received".

- [ ] **Step 4: Verify DB state**

In `pnpm db:studio`:
- `payments` table: a new row exists with `provider='paymongo'`, `status='succeeded'`, `amount_cents=99900`, `currency='PHP'`, `provider_payment_id` matching `cs_test_...`.
- `transactions` table: a new row exists with `kind='charge'`, `direction='credit'`, `amount_cents=99900`.
- `invoices` table: the open subscription invoice for this lawyer now has `status='paid'`, `paid_cents=99900`, `paid_at` set.
- `lawyer_subscriptions` table: `current_period_ends_at` advanced by 30 days, `last_paid_at` set to ~now, `status='active'`.

- [ ] **Step 5: Verify idempotency**

In PayMongo's dashboard (sandbox), find the webhook delivery for this payment and click "Resend." The api log should show the redelivery; the DB should not change. The webhook response body should be `{"idempotent":true, ...}`.

- [ ] **Step 6: If anything in Steps 3–5 failed, fix and commit before continuing**

Common issues:
- `lastPaidAt` doesn't change → the proxy route or banner polling is broken. Check `apps/web/app/api/lawyer-subscription-snapshot/route.ts` and the network tab.
- Webhook 401 → check `PAYMONGO_WEBHOOK_SECRET` matches what PayMongo returned in Step 1.
- Webhook 500 → check api logs; most likely `applyPaymentWebhook` threw because `metadata.invoiceId` didn't match any row.

If you make fixes, follow TDD: add a test for whatever broke, then fix, then commit.

---

## Task 8: Verification gate

Run the full verification suite before declaring done.

- [ ] **Step 1: Typecheck the whole graph**

Run: `pnpm typecheck`

Expected: no errors anywhere.

- [ ] **Step 2: Lint**

Run: `pnpm lint`

Expected: no new warnings or errors in the modified files.

- [ ] **Step 3: Run vitest**

Run: `pnpm --filter @ligala/api test`

Expected: 9 paymongo tests pass. No regressions in other packages.

- [ ] **Step 4: Smoke the Playwright `simulate=1` path still works**

Sign in as a lawyer. Navigate to `/lawyer/subscribe?simulate=1`. Click Subscribe. Expected: the old dev-simulate POST flow runs, the subscription period extends by 30 days. This confirms we didn't break local E2E.

(There is no automated Playwright test specifically for subscribe yet — the existing suite covers signup/onboarding only. Adding one is out of scope for this plan; the manual `?simulate=1` smoke is the gate today.)

- [ ] **Step 5: If anything in Steps 1–4 fails, fix it and re-run**

Fix any failures, follow TDD where the fix requires a code change, commit each fix as its own commit.

- [ ] **Step 6: Final commit if any cleanup remains**

If you have uncommitted changes from fixes, commit them:

```bash
git add <files>
git commit -m "<short message>"
```

If nothing to commit, you're done.

---

## Done

The lawyer subscription now charges real money via PayMongo. The `applyPaymentWebhook` invariants are unchanged; the SQS worker stub is unchanged; PayPal is intentionally a 501. Future work (out of scope for this plan): wire `workers/paymongo` to consume from SQS, add a USD plan for PayPal, add automated Playwright coverage for the simulate path.

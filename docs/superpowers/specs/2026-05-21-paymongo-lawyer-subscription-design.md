# PayMongo integration for lawyer subscription

**Date:** 2026-05-21
**Status:** Approved — ready for implementation plan
**Scope:** Replace the dev-simulate-only subscribe button on `/lawyer/subscribe` with a real PayMongo Checkout Session flow. PayPal is explicitly out of scope for v1.

## Problem

`apps/web/app/(lawyer)/lawyer/subscribe/subscribe-button.tsx` calls `startSubscriptionCheckout("dev_simulate")`, which posts to an in-house `/billing/dev/simulate-payment` route. There is no real payment integration. We need lawyers to actually pay ₱999/mo via card / GCash / Maya / GrabPay before the +30-day period extension fires.

The rails are already in place:
- `applyPaymentWebhook` in `apps/api/src/routes/billing.ts` is provider-agnostic, idempotent on `(provider, providerPaymentId)`, and already advances `lawyer_subscriptions.currentPeriodEndsAt` by 30 days on a `succeeded` payment to a `kind=subscription` invoice.
- `paymentWebhookInput` in `packages/shared/src/schemas/billing.ts` already accepts `provider: "paymongo" | "paypal" | "dev_simulate"`.
- `subscriptionCheckoutInput` likewise.
- `/webhooks/paymongo` exists but accepts a normalized dev payload — no signature verification, no provider-shape translation.
- `.env.example` already lists `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET`.

What's missing is the actual HTTP integration: create a PayMongo Checkout Session, redirect to it, verify the webhook signature on the way back, and translate the provider payload into the normalized form `applyPaymentWebhook` already understands.

## Decisions made during brainstorming

- **PayMongo only for v1.** PayPal in PH transacts in USD; the subscription is priced ₱999. PayPal button stays hidden behind a flag until we either add a USD price or confirm PHP support for our merchant. The `subscriptionCheckoutInput.provider` enum still accepts `"paypal"`, but the route returns `501 paypal_not_enabled`.
- **Hosted Checkout Session, not embedded card form.** Zero PCI scope; cards + GCash + Maya + GrabPay all on one provider-hosted page. Embedded would require us to implement each method's redirect dance separately.
- **Sync webhook in Hono, not SQS workers.** Matches today's `/webhooks/paymongo` shape and the CLAUDE.md note that real deployments enqueue to SQS but dev processes inline. The signature-verification + payload-translation code is independent of where the call happens, so an SQS migration later doesn't touch it. The `workers/paymongo` stub stays untouched.
- **`dev_simulate` stays.** E2E tests need it. Branch on `provider` inside `/lawyer/subscription/checkout`.

## Architecture

```
[Browser]               [apps/web]                 [apps/api]                [PayMongo]
   │                        │                          │                         │
   │ click Subscribe        │                          │                         │
   ├───────────────────────►│                          │                         │
   │                        │ startSubscriptionCheckout("paymongo")              │
   │                        ├─────────────────────────►│ POST /v1/checkout_sessions
   │                        │                          ├────────────────────────►│
   │                        │                          │◄── { checkout_url } ────┤
   │                        │◄── { checkoutUrl } ──────┤                         │
   │◄── window.location ────┤                          │                         │
   │                        │                          │                         │
   │     pays on PayMongo-hosted page (card/GCash/Maya/GrabPay) ─────────────────►│
   │                        │                          │                         │
   │◄── redirect to /lawyer/subscribe?status=success ───────────────────────────┤
   │                        │                          │                         │
   │                        │                          │◄── POST /webhooks/paymongo
   │                        │                          │      (signed payload)   │
   │                        │                          │   verify → translate →  │
   │                        │                          │   applyPaymentWebhook() │
   │                        │                          │   → +30 days            │
```

## File changes

**New**
- `apps/api/src/lib/paymongo.ts` — provider client with `createCheckoutSession(...)` and `verifyWebhookSignature(rawBody, header, secret)`. Pure functions, no Hono coupling. Unit-testable.

**Modified**
- `apps/api/src/routes/subscriptions.ts` — `/checkout` branches on `provider`. `paymongo` → calls `createCheckoutSession`. `dev_simulate` → unchanged. `paypal` → `501 paypal_not_enabled`.
- `apps/api/src/routes/webhooks.ts` — `/paymongo` reads the raw request body, verifies the `Paymongo-Signature` header, parses the event, extracts `metadata.invoiceId` and `data.id`, calls the existing `applyPaymentWebhook`.
- `apps/api/src/lib/env.ts` — register `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` (both optional at schema level so the api boots without them; required-at-use inside the route). The existing `BETTER_AUTH_URL` is reused as the web base URL for success/cancel URL construction.
- `apps/web/app/(lawyer)/lawyer/subscribe/subscribe-button.tsx` — on the PayMongo branch, do `window.location.assign(checkoutUrl)` instead of `fetch(checkoutUrl, { method: "POST" })`. Keep the simulate path behind `NODE_ENV !== "production"` and a `?simulate=1` query so Playwright can still hit it.
- `apps/web/app/(lawyer)/lawyer/subscribe/page.tsx` — read `status=success|cancelled` from `searchParams`; show a "Processing your payment…" / "Payment cancelled" banner above the price card.

**Unchanged**
- `apps/api/src/routes/billing.ts` — `applyPaymentWebhook` is provider-agnostic and stays as-is.
- `packages/shared/src/schemas/billing.ts` — `paymentWebhookInput` already supports `provider: "paymongo"`.
- `packages/shared/src/schemas/subscriptions.ts` — `subscriptionCheckoutInput` already supports `"paymongo"` and `"paypal"`.
- `workers/paymongo/handler.ts` — stays a stub; SQS path is a future phase.
- Drizzle schema — no migration needed.

## Component details

### `apps/api/src/lib/paymongo.ts`

Two exports:

```ts
export async function createCheckoutSession(input: {
  amountCents: number;
  currency: "PHP";
  lineDescription: string;
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string;
  metadata: { invoiceId: string; lawyerId: string };
  customerEmail?: string;
}): Promise<{ sessionId: string; checkoutUrl: string }>;

export function verifyWebhookSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): PaymongoEvent;
```

`createCheckoutSession`:
- Auth: `Authorization: Basic ${base64(PAYMONGO_SECRET_KEY + ":")}`.
- Body shape: `{ data: { attributes: { line_items: [{ amount, currency: "PHP", name, quantity: 1 }], success_url, cancel_url, reference_number, metadata, send_email_receipt: true, description } } }`.
- 2xx → return `{ sessionId: data.id, checkoutUrl: data.attributes.checkout_url }`.
- Non-2xx → throw `PaymongoApiError(status, body)` (tagged; the route maps it to `502 paymongo_request_failed`).
- Network/timeout → throw a separate tag the route maps to `502 paymongo_unreachable`.
- The PayMongo secret key value is redacted from any logged error.

`verifyWebhookSignature`:
- Header format: `t=<unix_ts>,te=<test_sig>,li=<live_sig>`.
- Compute `HMAC-SHA256(secret, ${t}.${rawBody})` and constant-time-compare against `te` (test) or `li` (live). We test both and accept either, then trust `livemode` on the parsed event for downstream behavior.
- Throws on missing header, malformed header, signature mismatch, tampered body.
- Returns the parsed event JSON.

### `/lawyer/subscription/checkout` (modified)

1. Resolve/create the unpaid `kind=subscription` invoice (existing logic, unchanged).
2. Branch on `provider`:
   - **`paymongo`**: if `env.PAYMONGO_SECRET_KEY` is unset, throw `501 paymongo_not_configured`. Otherwise call `createCheckoutSession({ amountCents: sub.priceCents, currency: "PHP", lineDescription: SUBSCRIPTION_LINE_DESCRIPTION, successUrl: `${env.BETTER_AUTH_URL}/lawyer/subscribe?status=success`, cancelUrl: `${env.BETTER_AUTH_URL}/lawyer/subscribe?status=cancelled`, referenceNumber: invoice.id, metadata: { invoiceId: invoice.id, lawyerId: user.id }, customerEmail: user.email })`. Return `{ provider, checkoutUrl, amountCents, currency: "PHP", invoiceId }`. Do **not** insert a row into `payments` — that invariant ("payments only exist for confirmed provider events") is preserved.
   - **`dev_simulate`**: unchanged behavior. Returns the in-house simulate URL.
   - **`paypal`**: throw `501 paypal_not_enabled`.
3. We always mint a fresh PayMongo session — we don't store and reuse a session id across `/checkout` calls. Sessions are free and expire after 1h, so reusing a stale one risks user confusion.

### `/webhooks/paymongo` (modified)

```
1. Read raw body via c.req.raw.text().
2. Header = c.req.header("Paymongo-Signature"). If absent → 401.
3. event = verifyWebhookSignature(raw, header, env.PAYMONGO_WEBHOOK_SECRET).
   On throw → 401.
4. type = event.data.attributes.type
5. If type not in { "checkout_session.payment.paid", "payment.paid",
   "payment.failed" } → 200 { ignored: true, type }.
6. resource = event.data.attributes.data           // cs_xxx or pay_xxx
   metadata = resource.attributes.metadata ?? {}
   invoiceId = metadata.invoiceId
   If !invoiceId → 200 { ignored: true, reason: "no_invoice_id" } + error log.
7. providerPaymentId = resource.id
   amountCents       = resource.attributes.total_amount ?? resource.attributes.amount
   status            = type === "payment.failed" ? "failed" : "succeeded"
   failureReason     = type === "payment.failed"
                         ? resource.attributes.last_payment_error?.message
                         : undefined
8. return await applyPaymentWebhook({
     provider: "paymongo",
     providerPaymentId,
     invoiceId,
     status,
     amountCents,
     currency: "PHP",
     failureReason,
     rawPayload: event,
   });
```

Idempotent replays are handled by the existing `(provider, providerPaymentId)` dedup.

### `apps/web/app/(lawyer)/lawyer/subscribe/subscribe-button.tsx` (modified)

```ts
function subscribe() {
  start(async () => {
    try {
      const res = await startSubscriptionCheckout("paymongo");
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  });
}
```

The old `dev_simulate` POST-and-refresh path is preserved when `NODE_ENV !== "production"` AND the URL has `?simulate=1`, so Playwright (which runs against `next dev`) keeps working without any new env var:

```ts
const provider =
  process.env.NODE_ENV !== "production" &&
  new URLSearchParams(window.location.search).get("simulate") === "1"
    ? "dev_simulate"
    : "paymongo";
```

### `apps/web/app/(lawyer)/lawyer/subscribe/page.tsx` (modified)

Read `sp.status`; render one of three banners above the existing price card:
- `success` → green "Processing your payment…" banner. A small client component polls `GET /lawyer/subscription` every 2s for up to 10s, calling `router.refresh()` when `lastPaidAt` advances. After refresh, banner updates to "Payment received — your subscription is active until {date}".
- `cancelled` → muted "Payment cancelled. You can try again anytime."
- otherwise → no banner.

## Error handling

| Scenario | HTTP | User sees | Logged |
|---|---|---|---|
| `PAYMONGO_SECRET_KEY` unset, lawyer clicks Subscribe | 501 `paymongo_not_configured` | "Payments are temporarily unavailable" | warn |
| PayMongo API 4xx (bad request, key mismatch) | 502 `paymongo_request_failed` | "Failed — try again" | error (body redacted) |
| PayMongo API 401/403 (suspended account) | 502 `paymongo_request_failed` | "Failed — try again" | error → Sentry |
| PayMongo API timeout / network error | 502 `paymongo_unreachable` | "Failed — try again" | error |
| Webhook with missing/invalid signature | 401 | n/a | warn (PayMongo will retry) |
| Webhook with unknown event type | 200 `{ ignored: true }` | n/a | info |
| Webhook with missing `metadata.invoiceId` | 200 `{ ignored: true }` | n/a | error (shouldn't happen) |
| Webhook valid, applyPaymentWebhook throws | 5xx (let it bubble) | n/a | error → Sentry → PayMongo retries |
| Webhook replay (same providerPaymentId) | 200 `{ idempotent: true }` | n/a | info |
| User abandons at PayMongo, returns next day | new session minted on retry | normal flow | — |
| Redirect lands before webhook arrives | "Processing…" banner polls for 10s | resolves on its own | — |

## Configuration

Add to `apps/api/src/lib/env.ts`:

```ts
PAYMONGO_SECRET_KEY: z.string().optional(),       // sk_test_xxx or sk_live_xxx
PAYMONGO_WEBHOOK_SECRET: z.string().optional(),   // whsk_xxx
```

`.env.example` already lists both, so no change there. The existing `BETTER_AUTH_URL` (already required and validated) is reused as the base for success/cancel URLs — no new env var is introduced.

For local dev: PayMongo sends webhooks to publicly reachable URLs only. The tunnel (ngrok / Cloudflare) must point at `:8787/webhooks/paymongo`. The tunnel URL is registered once via `POST /v1/webhooks` on PayMongo, subscribing to:
- `checkout_session.payment.paid`
- `payment.paid`
- `payment.failed`

That `POST /v1/webhooks` is a manual one-time step, not part of the deployable code. Document it in the implementation plan's "Local sandbox setup" section.

## Testing

**Unit (`apps/api`, vitest)**
- `paymongo.test.ts`:
  - `verifyWebhookSignature`: accepts valid header; rejects wrong secret, malformed header, missing `te`/`li`, tampered body. Constant-time compare verified.
  - `createCheckoutSession`: mock `fetch`. Assert Basic auth header, `currency: "PHP"`, `amount === priceCents`, `metadata.invoiceId` set, success/cancel URLs absolute, returned `checkoutUrl` matches mock.
  - Error paths: 401, timeout, non-JSON response → tagged errors.
- `webhooks.paymongo.test.ts`:
  - Missing signature → 401.
  - Bad signature → 401.
  - Unknown event with good signature → 200 `{ ignored: true }`, no payment row.
  - Valid `checkout_session.payment.paid` with metadata → payment row, invoice paid, period +30 days, transactions row inserted.
  - Replay → 200 `{ idempotent: true }`, no double-extension.
- `subscriptions.test.ts`:
  - `POST /checkout { provider: "paymongo" }` (with `createCheckoutSession` mocked) → non-empty `checkoutUrl` + `invoiceId`. Fresh session minted even when reusing invoice.
  - `{ provider: "paypal" }` → 501.
  - Missing key → 501.

**E2E (Playwright)**
- Existing `dev_simulate` subscribe test stays green (regression check).
- New test: stub the `POST /lawyer/subscription/checkout` response with a fake URL, then directly POST a signed payload to `/webhooks/paymongo` using a test secret, then navigate to `/lawyer/subscribe?status=success` and assert the banner + new period end.

**Manual sandbox verification (one-time, in implementation plan)**
- Start tunnel, register webhook with PayMongo sandbox.
- Open `/lawyer/subscribe` as a real seeded lawyer, click Subscribe.
- Complete a sandbox card payment.
- Confirm: redirect lands on `/lawyer/subscribe?status=success`, banner transitions from "Processing…" to "Payment received", `payments` table has a row with `provider=paymongo` + `status=succeeded`, `lawyer_subscriptions.currentPeriodEndsAt` advanced by 30 days, `transactions` table has a `kind=charge, direction=credit` row.

## Out of scope (explicit non-goals)

- PayPal integration. Returns 501 from `/checkout`; button hidden in UI.
- SQS-backed webhook processing. The `workers/paymongo` stub stays; a future phase will move signature-verification + DB write into the worker.
- Refund flow via PayMongo's refund API. `refundPayment` in `billing.ts` stays accounting-only; provider-side refunds are a separate effort.
- Client invoice checkout flow. Same `applyPaymentWebhook` would back it, but the `/billing/invoices/:id/checkout` route isn't part of this change.
- Production deploy of the integration. CDK stack changes (Secrets Manager for keys, API Gateway route exposure of `/webhooks/paymongo`) are intentionally deferred — local dev verification with the tunnel proves the flow.
- Customizing PayMongo's hosted page branding. Default styling is acceptable for v1.

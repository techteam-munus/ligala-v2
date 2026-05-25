# Transactional Email Pipeline — Design Spec

- **Date:** 2026-05-25
- **Status:** Approved (brainstorming) — ready for implementation planning
- **Author:** Session 17 (Claude + techteam)
- **Related:** `docs/superpowers/specs/2026-05-21-paymongo-lawyer-subscription-design.md`; PROCESS.md Phase 8

## 1. Context & goal

SES is now out of the sandbox (production access granted 2026-05-25; sender domain `mymunus.com` DKIM-verified; quota 50k/day, 14/sec). The scaffolding for email exists but is empty: `workers/email/handler.ts` is a no-op, `packages/email/src/index.ts` is `export {}`, there is no SES producer, no `email_log` table, and no SQS/worker deployed. Better Auth has `requireEmailVerification: false` and no email hooks wired.

**Goal:** build a production-grade, decoupled transactional-email pipeline (SQS worker model) and wire the first set of producers, so the app actually sends mail.

## 2. Scope

**In scope (this build):**

- Shared pipeline: SQS queue + DLQ, email worker Lambda, `email_log` table, SES send, React Email templates, `enqueueEmail()` producer helper.
- Event-driven emails:
  - **Auth:** email verification (hard) + password reset (Better Auth hooks).
  - **Billing:** invoice sent (client) + payment receipt (client, for case invoices).
  - **Cases:** case/engagement status changes (counterparty).
  - **Subscription:** payment receipt (lawyer, for subscription invoices).
- Flip `requireEmailVerification = true` — **env-gated, sequenced after the pipeline is deployed and verified.**
- Dev/test auto-verify route so hard verification doesn't break automation.

**Out of scope (deferred):**

- Subscription **expiry-reminder** scanner (needs EventBridge schedule + scanner Lambda — separate producer model; fast-follow).
- Custom bounce/complaint suppression (rely on SES account-level managed suppression for v1; wiring a configuration set + SNS event destination is a fast-follow).
- Marketing/bulk email, unsubscribe center (transactional only).
- The other worker stubs (`paymongo`, `paypal`, `idmeta`, `image`) stay as-is.

## 3. Architecture

```
Producer (API route / Better Auth hook)
  1. INSERT email_log (status=queued, UNIQUE dedupeKey)  [ON CONFLICT DO NOTHING]
  2. enqueueEmail(msg) -> SQS SendMessage (EMAIL_QUEUE_URL)
        |
        v
  email-queue (SQS)  --maxReceiveCount=3-->  email-dlq (SQS, alarmed)
        |
        v
  email worker Lambda  (VPC private subnets; batchSize=10; reportBatchItemFailures)
    - parse + validate message (shared Zod union)
    - load email_log by dedupeKey; if status=sent -> ack (duplicate delivery)
    - renderEmail(kind, data) -> { subject, html, text }   (React Email)
    - SES SendEmail
    - UPDATE email_log -> sent + providerMessageId   (or failed + error, then throw to retry)
        |
        v
  recipient
```

At-least-once SQS delivery + `email_log` dedupe ⇒ exactly-once *effective* send. Mirrors the existing payment-webhook idempotency pattern (unique key, skip-if-already-applied).

## 4. Components

| Package | Change |
|---|---|
| `@ligala/shared` | New `src/schemas/email.ts`: Zod **discriminated union** `emailMessage` on `kind`. Stable error codes if needed. Imported by producer + worker. |
| `@ligala/email` | `src/queue.ts` → `enqueueEmail(msg)` (SQS `SendMessage`; reads `EMAIL_QUEUE_URL`; no React import). `src/templates/*` → React Email components + shared branded layout. `src/render.ts` → `renderEmail(kind, data) → { subject, html, text }`. Separate entrypoints so `enqueueEmail` doesn't pull React into producer bundles. |
| `@ligala/db` | New `email_log` table + `email_status` enum + migration (`packages/db/drizzle/NNNN_*.sql`). |
| `@ligala/auth` | Wire `emailVerification.sendVerificationEmail` + `sendResetPassword` → `enqueueEmail`. `requireEmailVerification` driven by env `EMAIL_VERIFICATION_REQUIRED` (**default false** — fail-safe; set true in dev/prod only *after* the pipeline is deployed, per §11). |
| `apps/api` | Producer enqueue calls (§6). New env-gated dev route `POST /accounts/_dev/verify-email` (mirrors existing `/files/_dev/upload`, `/billing/dev/simulate-payment` stubs). `EMAIL_QUEUE_URL` + email env in `lib/env.ts` + bootstrap. |
| `workers/email` | Implement handler: parse → dedupe → render → SES → log. |
| `infra` | SQS queue + DLQ, worker Lambda (VPC + DB + SES), event-source mapping, IAM, `Monitoring.attach*`. |

**Dependency direction:** `@ligala/auth` → `@ligala/email` (enqueue); `apps/api` → `@ligala/email` (enqueue) + `@ligala/shared`; `workers/email` → `@ligala/email` (render) + `@ligala/db` + `@ligala/shared`. No cycles.

## 5. Message contract & `email_log`

**SQS message** — self-contained data snapshot (the worker never re-reads domain tables; it touches the DB only for `email_log`). Zod union, validated on enqueue and again in the worker (trust boundary):

```ts
type EmailMessage =
  | { kind: "auth_verify";          to: string; dedupeKey: string; data: { name: string; verifyUrl: string } }
  | { kind: "auth_reset";           to: string; dedupeKey: string; data: { name: string; resetUrl: string } }
  | { kind: "invoice_sent";         to: string; dedupeKey: string; data: { clientName: string; lawyerName: string; invoiceNumber: string; amountFormatted: string; currency: string; invoiceUrl: string } }
  | { kind: "payment_receipt";      to: string; dedupeKey: string; data: { clientName: string; invoiceNumber: string; amountPaidFormatted: string; currency: string; paidAtFormatted: string; invoiceUrl: string } }
  | { kind: "case_status";          to: string; dedupeKey: string; data: { recipientName: string; caseRef: string; event: "case_created" | "case_accepted" | "case_declined" | "engagement_sent" | "engagement_signed" | "engagement_declined" | "case_closed"; actorName: string; caseUrl: string } }
  | { kind: "subscription_receipt"; to: string; dedupeKey: string; data: { lawyerName: string; invoiceNumber: string; amountFormatted: string; currency: string; periodEndFormatted: string; subscriptionUrl: string } };
```

**`email_log` table:**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `kind` | text/enum | matches message `kind` |
| `recipient` | text | email address |
| `dedupe_key` | text | **UNIQUE** |
| `status` | `email_status` enum | `queued` \| `sent` \| `failed` \| `suppressed` |
| `provider_message_id` | text null | SES `MessageId` |
| `error` | text null | last error |
| `attempts` | int default 0 | bumped each worker touch |
| `created_at`, `updated_at`, `sent_at` | timestamptz | |

**`dedupeKey` formats** (stable per logical email):

- `auth_verify:<userId>:<tokenHash>` / `auth_reset:<userId>:<tokenHash>` — a re-issued token ⇒ new key ⇒ genuinely re-sends.
- `invoice_sent:<invoiceId>`
- `payment_receipt:<paymentId>`
- `subscription_receipt:<paymentId>`
- `case_status:<caseActivityId>` — tied to the append-only `case_activity` row, so each transition emits exactly once.

## 6. Producer wiring

| Trigger | Where | Recipient | `kind` |
|---|---|---|---|
| Signup verification | `@ligala/auth` `sendVerificationEmail` hook | the user | `auth_verify` |
| Password reset | `@ligala/auth` `sendResetPassword` hook | the user | `auth_reset` |
| Invoice sent | `apps/api` `/invoices/:id/send` | client | `invoice_sent` |
| Payment succeeded (case invoice) | `applyPaymentWebhook` | client | `payment_receipt` |
| Payment succeeded (subscription invoice) | `applyPaymentWebhook` | lawyer | `subscription_receipt` |
| Case created | `apps/api` `/cases` POST | lawyer | `case_status` (`case_created`) |
| Case accepted / declined | `/cases/:id/decision` | client | `case_status` |
| Engagement sent | `/engagements/cases/:caseId` | client | `case_status` (`engagement_sent`) |
| Engagement signed / declined | `/engagements/:id/decision` | lawyer | `case_status` |
| Case closed / cancelled | `/cases/:id/close` | the other party | `case_status` (`case_closed`) |

`applyPaymentWebhook` branches on `invoice.kind` (`subscription` → lawyer receipt; otherwise → client receipt). Producer pattern everywhere: write `email_log(queued)` `ON CONFLICT (dedupe_key) DO NOTHING`, then `enqueueEmail`. Enqueue failure is logged and swallowed (never fails the user's request).

Better Auth hooks run in the runtime that handles `/auth/*` — the **API Lambda** (the web app's `/api/auth/*` rewrites to it), which is where `EMAIL_QUEUE_URL` + SQS send permission live. `enqueueEmail` must no-op gracefully (log, swallow) if `EMAIL_QUEUE_URL` is unset, so importing `@ligala/auth` in the web/Amplify runtime never throws.

## 7. Worker behavior

1. For each SQS record: `JSON.parse` → validate with `emailMessage` Zod union. Parse failure → record-level failure (goes to DLQ; do not poison the batch).
2. Load `email_log` by `dedupeKey`. If `status = sent` → **ack** (duplicate delivery). If row missing (producer-side insert lost) → create it.
3. `renderEmail(kind, data) → { subject, html, text }`.
4. `SES SendEmail` (from `EMAIL_FROM`, reply-to `EMAIL_REPLY_TO`).
5. On success: `email_log → sent`, set `provider_message_id`, `sent_at`, bump `attempts`. On SES failure: `email_log → failed`, set `error`, bump `attempts`, then **throw** so SQS retries; after `maxReceiveCount` the message lands in the DLQ.
6. Return `{ batchItemFailures }` for only the failed records (`reportBatchItemFailures`).

## 8. Error handling

- **Partial batch:** `batchItemFailures` retries only failed records.
- **Retry/DLQ:** `maxReceiveCount = 3` → `email-dlq`; `Monitoring.attachDlqDepth` alarms on any depth.
- **Dedupe:** worker skips `status=sent`; the `dedupe_key` unique constraint prevents two concurrent workers double-sending.
- **Bounces/complaints:** rely on SES account-level managed suppression (default-on) for v1. Custom handling deferred.
- **Producer enqueue failure:** logged + swallowed; `queued` row remains as the audit record.

## 9. Infra (AppStack)

- `email-queue` + `email-dlq` (redrive `maxReceiveCount=3`; queue visibility timeout > worker timeout).
- **Email worker Lambda**, code from `workers/dist/email/handler.js`. In **VPC private subnets** (needs RDS Proxy for `email_log`; reaches SES via the existing NAT — an SES interface VPC endpoint is a later cost optimization). Reuses the `bootstrap-env` Secrets pattern for `DATABASE_URL`; `DbClientSg` attached.
- Event-source mapping SQS → worker (`batchSize: 10`, `reportBatchItemFailures: true`).
- **IAM:** worker role → `ses:SendEmail`/`SendRawEmail` scoped to the `mymunus.com` identity ARN + SQS consume on `email-queue` + Secrets read + DB SG. API Lambda role → `sqs:SendMessage` on `email-queue`.
- **Monitoring:** `attachLambdaErrors` / `attachLambdaThrottles` / `attachLambdaDurationP95` on the worker + `attachDlqDepth` on the DLQ — called at construction (per the "attach on the line the resource is created" convention).
- **Build:** `workers` esbuild already bundles `email/handler.ts` (externalizes `@aws-sdk/*` + `sharp`); React Email render gets bundled. `@ligala/email` is already a `workers` dependency.

## 10. Env vars

| Var | Consumer | Default / notes |
|---|---|---|
| `EMAIL_QUEUE_URL` | API (producers) | set by CDK; unset ⇒ `enqueueEmail` no-ops |
| `EMAIL_FROM` | worker | `no-reply@mymunus.com` |
| `EMAIL_REPLY_TO` | worker | `support@mymunus.com` |
| `EMAIL_VERIFICATION_REQUIRED` | `@ligala/auth` | **default false** (fail-safe — no lock-out if unset); set true in dev + prod via follow-up deploy *after* pipeline verified; always false for local + test |
| `EMAIL_DEV_VERIFY_ENABLED` | API | gate for `_dev/verify-email`; on in dev/test only |

All new API-side vars added to `apps/api/src/lib/env.ts` (Zod-validated) per convention.

## 11. Auth verification sequencing & dev verify

1. Build + deploy the pipeline. Verify a real send (`email_log.sent` + SES `MessageId`).
2. **Then** a follow-up deploy sets `EMAIL_VERIFICATION_REQUIRED=true`. Doing it earlier would lock out new signups (no email to verify with).
3. **Dev/test auto-verify:** env-gated `POST /accounts/_dev/verify-email` marks a user's email verified without an inbox round-trip. Used by the Playwright signup spec and ad-hoc API setup (e.g., the PayMongo smoke flow). Keeps hard verification in prod without breaking automation.

## 12. Testing

- **Unit (`@ligala/email`):** `renderEmail` produces non-empty `html` + `text` + a subject for each `kind`; `enqueueEmail` builds the correct message + `dedupeKey` and no-ops when `EMAIL_QUEUE_URL` unset.
- **Unit (`workers/email`):** dedupe (skip when `status=sent`), partial-batch `batchItemFailures`, SES-error → `failed` + throw, message validation rejects malformed bodies. SES + DB mocked.
- **Unit (`@ligala/auth`):** the verification/reset hooks call `enqueueEmail` with the right `kind` + recipient.
- **No live-inbox assertion.** Success criterion = `email_log` row transitions to `sent` with a SES `MessageId`.
- Manual post-deploy smoke: trigger one of each `kind`, confirm `email_log` + a real delivered message.

## 13. Implementation sequencing (feeds writing-plans)

1. `email_log` schema + migration; `email_status` enum.
2. `@ligala/shared` `emailMessage` Zod union.
3. `@ligala/email`: `enqueueEmail`, `renderEmail`, templates + layout.
4. `workers/email` handler implementation + unit tests.
5. Producer wiring (auth hooks, billing, cases/engagements, webhook receipts) + dev-verify route.
6. Infra: queue/DLQ/worker/event-source/IAM/Monitoring + env.
7. Deploy; post-deploy send smoke.
8. Follow-up: flip `EMAIL_VERIFICATION_REQUIRED=true` + add gating/UX for unverified users; update Playwright signup spec to use the dev-verify route.

## 14. Open questions

- None blocking. Minor: whether to add the SES interface VPC endpoint now vs. accept NAT egress for the worker (default: NAT now, endpoint later if cost warrants).

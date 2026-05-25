# Transactional Email Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a decoupled SQS-backed transactional email pipeline (queue → worker Lambda → React Email render → SES) and wire the first producers (auth verify/reset, invoice sent, payment/subscription receipts, case status), with idempotent delivery via an `email_log` table.

**Architecture:** Producers (`apps/api` routes + Better Auth hooks) call `dispatchEmail(msg)` which records an `email_log(queued)` row (unique `dedupeKey`) and `SendMessage`s to SQS. A worker Lambda consumes the queue, dedupes on `email_log`, renders the React Email template, sends via SES, and marks the row `sent`/`failed`. Retries → DLQ (alarmed). Hard email verification is flipped on via env **after** the pipeline deploys.

**Tech Stack:** Drizzle (Postgres), Zod (`@ligala/shared`), React Email (`@ligala/email`), `@aws-sdk/client-sqs` + `client-ses`, AWS CDK (SQS + Lambda event source + IAM + Monitoring), Better Auth, Vitest.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-25-email-worker-design.md`. Read it before starting.

---

## File Structure

**Create:**
- `packages/db/src/schema/email.ts` — `emailStatus` enum + `emailLog` table
- `packages/db/src/bootstrap-env.ts` — shared Secrets-Manager env bootstrap (extracted from `apps/api`)
- `packages/shared/src/schemas/email.ts` — `emailMessage` Zod discriminated union
- `packages/email/src/queue.ts` — `enqueueEmail` + `dispatchEmail`
- `packages/email/src/render.ts` — `renderEmail(kind, data)`
- `packages/email/src/templates/layout.tsx` — shared branded layout
- `packages/email/src/templates/{auth-verify,auth-reset,invoice-sent,payment-receipt,case-status,subscription-receipt}.tsx`
- `packages/email/src/render.test.ts`, `packages/email/src/queue.test.ts`
- `workers/email/handler.test.ts`
- `apps/api/src/routes/dev-accounts.ts` — env-gated `_dev/verify-email` (or add to existing accounts/clients router — see Task 8)

**Modify:**
- `packages/db/src/schema/index.ts` — `export * from "./email"`
- `apps/api/src/lib/bootstrap-env.ts` — re-export from `@ligala/db`
- `apps/api/src/lib/env.ts` — add `EMAIL_QUEUE_URL`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_VERIFICATION_REQUIRED`, `EMAIL_DEV_VERIFY_ENABLED`
- `packages/auth/src/index.ts` — verification/reset hooks + env-gated `requireEmailVerification`
- `packages/email/package.json` — add `@ligala/db`, `@ligala/shared`, `@aws-sdk/client-sqs`, `@aws-sdk/client-ses`
- `workers/email/handler.ts` — implement
- `apps/api/src/routes/billing.ts` — `invoice_sent` enqueue on send
- `apps/api/src/routes/webhooks.ts` (or wherever `applyPaymentWebhook` lives) — receipt enqueues
- `apps/api/src/routes/cases.ts`, `apps/api/src/routes/engagements.ts` — `case_status` enqueues
- `infra/lib/app-stack.ts` — SQS queue + DLQ + worker Lambda + event source + IAM + Monitoring + `EMAIL_QUEUE_URL` on API Lambda
- `infra/lib/monitoring.ts` — confirm/add `attachDlqDepth` (likely already present)

> **Note on repetition:** Task 4 writes the layout + one template in full and specifies the other five with exact props/subject/copy (they are structurally identical React Email components). Task 9 wires three billing producers in full; Task 10 wires the case/engagement producers using the exact trigger/recipient/dedupeKey table from spec §6. This is deliberate, not a placeholder — each sibling has all the concrete detail needed.

---

## Task 1: `email_log` table + migration

**Files:**
- Create: `packages/db/src/schema/email.ts`
- Modify: `packages/db/src/schema/index.ts`
- Migration: `packages/db/drizzle/NNNN_*.sql` (generated)

- [ ] **Step 1: Write the schema**

`packages/db/src/schema/email.ts`:
```ts
import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed", "suppressed"]);

export const emailKind = pgEnum("email_kind", [
  "auth_verify",
  "auth_reset",
  "invoice_sent",
  "payment_receipt",
  "case_status",
  "subscription_receipt",
]);

export const emailLog = pgTable(
  "email_log",
  {
    id: text("id").primaryKey(),
    kind: emailKind("kind").notNull(),
    recipient: text("recipient").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    status: emailStatus("status").default("queued").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    dedupeKeyUnique: uniqueIndex("email_log_dedupe_key_unique").on(t.dedupeKey),
  }),
);
```

- [ ] **Step 2: Register in the schema index**

Add to `packages/db/src/schema/index.ts` after the other exports:
```ts
export * from "./email";
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `packages/db/drizzle/NNNN_*.sql` containing `CREATE TYPE "email_status"`, `CREATE TYPE "email_kind"`, `CREATE TABLE "email_log"`, and the unique index. Confirm the file exists and contains the unique index on `dedupe_key`.

- [ ] **Step 4: Apply locally**

Run: `pnpm db:migrate`
Expected: applies cleanly; `email_log` table exists. Verify: `pnpm db:studio` (or psql `\dt`) shows `email_log`.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @ligala/db typecheck`
Expected: PASS
```bash
git add packages/db/src/schema/email.ts packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat(db): add email_log table for transactional email pipeline"
```

---

## Task 2: Shared `emailMessage` Zod union

**Files:**
- Create: `packages/shared/src/schemas/email.ts`
- Modify: `packages/shared/src/schemas/index.ts` (export the new module — match existing export style)
- Test: `packages/shared/src/schemas/email.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/schemas/email.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { emailMessage } from "./email";

describe("emailMessage", () => {
  it("accepts a valid auth_verify message", () => {
    const r = emailMessage.safeParse({
      kind: "auth_verify",
      to: "a@b.com",
      dedupeKey: "auth_verify:u1:abc",
      data: { name: "Ana", verifyUrl: "https://x/verify?token=abc" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const r = emailMessage.safeParse({ kind: "nope", to: "a@b.com", dedupeKey: "x", data: {} });
    expect(r.success).toBe(false);
  });

  it("rejects invoice_sent missing required data", () => {
    const r = emailMessage.safeParse({
      kind: "invoice_sent",
      to: "a@b.com",
      dedupeKey: "invoice_sent:i1",
      data: { clientName: "Ana" },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ligala/shared test -- email`
Expected: FAIL — `Cannot find module './email'`.

- [ ] **Step 3: Write the schema**

`packages/shared/src/schemas/email.ts`:
```ts
import { z } from "zod";

const base = { to: z.string().email(), dedupeKey: z.string().min(1) };

export const emailMessage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("auth_verify"), ...base, data: z.object({ name: z.string(), verifyUrl: z.string().url() }) }),
  z.object({ kind: z.literal("auth_reset"), ...base, data: z.object({ name: z.string(), resetUrl: z.string().url() }) }),
  z.object({
    kind: z.literal("invoice_sent"), ...base,
    data: z.object({ clientName: z.string(), lawyerName: z.string(), invoiceNumber: z.string(), amountFormatted: z.string(), currency: z.string(), invoiceUrl: z.string().url() }),
  }),
  z.object({
    kind: z.literal("payment_receipt"), ...base,
    data: z.object({ clientName: z.string(), invoiceNumber: z.string(), amountPaidFormatted: z.string(), currency: z.string(), paidAtFormatted: z.string(), invoiceUrl: z.string().url() }),
  }),
  z.object({
    kind: z.literal("case_status"), ...base,
    data: z.object({
      recipientName: z.string(), caseRef: z.string(),
      event: z.enum(["case_created", "case_accepted", "case_declined", "engagement_sent", "engagement_signed", "engagement_declined", "case_closed"]),
      actorName: z.string(), caseUrl: z.string().url(),
    }),
  }),
  z.object({
    kind: z.literal("subscription_receipt"), ...base,
    data: z.object({ lawyerName: z.string(), invoiceNumber: z.string(), amountFormatted: z.string(), currency: z.string(), periodEndFormatted: z.string(), subscriptionUrl: z.string().url() }),
  }),
]);

export type EmailMessage = z.infer<typeof emailMessage>;
export type EmailKind = EmailMessage["kind"];
```

- [ ] **Step 4: Export from the schemas index**

Open `packages/shared/src/schemas/index.ts`, add (matching the existing `export * from "./<x>"` style):
```ts
export * from "./email";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ligala/shared test -- email`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/email.ts packages/shared/src/schemas/email.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add emailMessage zod union"
```

---

## Task 3: `@ligala/email` — `enqueueEmail` + `dispatchEmail`

**Files:**
- Modify: `packages/email/package.json`
- Create: `packages/email/src/queue.ts`, `packages/email/src/queue.test.ts`
- Modify: `packages/email/src/index.ts`

- [ ] **Step 1: Add dependencies**

Edit `packages/email/package.json` `dependencies` to add:
```json
"@ligala/db": "workspace:*",
"@ligala/shared": "workspace:*",
"@aws-sdk/client-sqs": "^3.700.0"
```
Run: `pnpm install`
Expected: installs cleanly, no peer warnings.

- [ ] **Step 2: Write the failing test**

`packages/email/src/queue.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({ send })),
  SendMessageCommand: vi.fn((input) => ({ input })),
}));

import { enqueueEmail } from "./queue";
import type { EmailMessage } from "@ligala/shared/schemas";

const msg: EmailMessage = {
  kind: "auth_verify", to: "a@b.com", dedupeKey: "auth_verify:u1:abc",
  data: { name: "Ana", verifyUrl: "https://x/verify?token=abc" },
};

beforeEach(() => { send.mockReset(); delete process.env.EMAIL_QUEUE_URL; });

describe("enqueueEmail", () => {
  it("no-ops when EMAIL_QUEUE_URL is unset", async () => {
    await enqueueEmail(msg);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a SendMessage with the JSON body when configured", async () => {
    process.env.EMAIL_QUEUE_URL = "https://sqs/q";
    send.mockResolvedValue({});
    await enqueueEmail(msg);
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0][0];
    expect(JSON.parse(cmd.input.MessageBody)).toMatchObject({ kind: "auth_verify", to: "a@b.com" });
  });
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `pnpm --filter @ligala/email test -- queue`
Expected: FAIL — `Cannot find module './queue'`.

- [ ] **Step 3: Implement `queue.ts`**

`packages/email/src/queue.ts`:
```ts
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { db, schema } from "@ligala/db";
import type { EmailMessage } from "@ligala/shared/schemas";

let client: SQSClient | null = null;
function sqs(): SQSClient {
  if (!client) client = new SQSClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return client;
}

/** Enqueue only. No-ops (logs) when EMAIL_QUEUE_URL is unset so importing this
 *  in a runtime without SQS access (e.g. web/Amplify) never throws. */
export async function enqueueEmail(msg: EmailMessage): Promise<void> {
  const url = process.env.EMAIL_QUEUE_URL;
  if (!url) {
    console.warn("[email] EMAIL_QUEUE_URL unset; skipping enqueue", msg.kind, msg.dedupeKey);
    return;
  }
  await sqs().send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify(msg) }));
}

/** Record an email_log(queued) row (idempotent on dedupeKey), then enqueue.
 *  Producer-facing entry point. Swallows errors so it never fails the caller's
 *  request — a lost notification is recoverable; a failed user action is not. */
export async function dispatchEmail(msg: EmailMessage): Promise<void> {
  try {
    await db()
      .insert(schema.emailLog)
      .values({ id: crypto.randomUUID(), kind: msg.kind, recipient: msg.to, dedupeKey: msg.dedupeKey, status: "queued" })
      .onConflictDoNothing({ target: schema.emailLog.dedupeKey });
    await enqueueEmail(msg);
  } catch (err) {
    console.error("[email] dispatchEmail failed", msg.kind, msg.dedupeKey, err);
  }
}
```

- [ ] **Step 4: Export from index**

Edit `packages/email/src/index.ts`:
```ts
export { enqueueEmail, dispatchEmail } from "./queue";
export { renderEmail } from "./render";
```
(`./render` lands in Task 4 — typecheck this package after Task 4, not now.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ligala/email test -- queue`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/email/package.json packages/email/src/queue.ts packages/email/src/queue.test.ts packages/email/src/index.ts pnpm-lock.yaml
git commit -m "feat(email): add enqueueEmail + dispatchEmail producer helpers"
```

---

## Task 4: `@ligala/email` — `renderEmail` + layout + templates

**Files:**
- Modify: `packages/email/package.json` (add `@aws-sdk/client-ses` for Task 6's worker import path consistency — optional here)
- Create: `packages/email/src/templates/layout.tsx`, `.../auth-verify.tsx` (+ 5 siblings), `packages/email/src/render.ts`, `packages/email/src/render.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/email/src/render.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { renderEmail } from "./render";

describe("renderEmail", () => {
  it("renders auth_verify with subject + non-empty html/text", async () => {
    const out = await renderEmail("auth_verify", { name: "Ana", verifyUrl: "https://x/v?t=1" });
    expect(out.subject.length).toBeGreaterThan(0);
    expect(out.html).toContain("https://x/v?t=1");
    expect(out.text.length).toBeGreaterThan(0);
  });

  it("renders every kind without throwing", async () => {
    const samples = {
      auth_verify: { name: "A", verifyUrl: "https://x/v" },
      auth_reset: { name: "A", resetUrl: "https://x/r" },
      invoice_sent: { clientName: "A", lawyerName: "L", invoiceNumber: "INV-1", amountFormatted: "₱5,500.00", currency: "PHP", invoiceUrl: "https://x/i" },
      payment_receipt: { clientName: "A", invoiceNumber: "INV-1", amountPaidFormatted: "₱5,500.00", currency: "PHP", paidAtFormatted: "May 25, 2026", invoiceUrl: "https://x/i" },
      case_status: { recipientName: "A", caseRef: "Case #1", event: "engagement_sent", actorName: "L", caseUrl: "https://x/c" },
      subscription_receipt: { lawyerName: "L", invoiceNumber: "INV-2", amountFormatted: "₱999.00", currency: "PHP", periodEndFormatted: "Jul 24, 2026", subscriptionUrl: "https://x/s" },
    } as const;
    for (const [kind, data] of Object.entries(samples)) {
      const out = await renderEmail(kind as keyof typeof samples, data as never);
      expect(out.html.length).toBeGreaterThan(0);
      expect(out.subject.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ligala/email test -- render`
Expected: FAIL — `Cannot find module './render'`.

- [ ] **Step 3: Write the shared layout**

`packages/email/src/templates/layout.tsx`:
```tsx
import { Body, Container, Head, Hr, Html, Section, Text } from "@react-email/components";
import * as React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f6f6f6", fontFamily: "Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, maxWidth: 560, margin: "0 auto", padding: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>Ligala</Text>
          <Hr style={{ borderColor: "#eee", margin: "16px 0" }} />
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#eee", margin: "24px 0 16px" }} />
          <Text style={{ fontSize: 12, color: "#888", margin: 0 }}>
            Ligala by Munus · This is a transactional message. Replies go to support@mymunus.com.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4: Write the `auth-verify` template (the worked example)**

`packages/email/src/templates/auth-verify.tsx`:
```tsx
import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function AuthVerify({ name, verifyUrl }: { name: string; verifyUrl: string }) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {name},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>
        Confirm your email address to activate your Ligala account.
      </Text>
      <Button href={verifyUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>
        Verify email
      </Button>
      <Text style={{ fontSize: 12, color: "#888" }}>Or paste this link: {verifyUrl}</Text>
    </Layout>
  );
}
```

- [ ] **Step 5: Write the five sibling templates**

Each is the same shape as Task 4 Step 4 (props from the matching `emailMessage` `data` in Task 2), exported as a named component, wrapped in `<Layout>`. Create:

- `auth-reset.tsx` → `AuthReset({ name, resetUrl })`: body "Reset your Ligala password.", a `Button href={resetUrl}` "Reset password", and the paste-link line. Add: "If you didn't request this, ignore this email."
- `invoice-sent.tsx` → `InvoiceSent({ clientName, lawyerName, invoiceNumber, amountFormatted, currency, invoiceUrl })`: body "{lawyerName} sent you invoice {invoiceNumber} for {amountFormatted}.", `Button href={invoiceUrl}` "View & pay invoice".
- `payment-receipt.tsx` → `PaymentReceipt({ clientName, invoiceNumber, amountPaidFormatted, currency, paidAtFormatted, invoiceUrl })`: body "We received your payment of {amountPaidFormatted} for invoice {invoiceNumber} on {paidAtFormatted}.", `Button href={invoiceUrl}` "View invoice".
- `case-status.tsx` → `CaseStatus({ recipientName, caseRef, event, actorName, caseUrl })`: map `event` → a one-line message (see the table below), then `Button href={caseUrl}` "Open case".
- `subscription-receipt.tsx` → `SubscriptionReceipt({ lawyerName, invoiceNumber, amountFormatted, currency, periodEndFormatted, subscriptionUrl })`: body "Your Ligala subscription payment of {amountFormatted} (invoice {invoiceNumber}) is confirmed. Your access is active through {periodEndFormatted}.", `Button href={subscriptionUrl}` "Manage subscription".

`case-status` event → copy map (used inside the component):
```ts
const EVENT_COPY: Record<string, string> = {
  case_created: "{actorName} sent you a new case request: {caseRef}.",
  case_accepted: "{actorName} accepted your case: {caseRef}.",
  case_declined: "{actorName} declined your case: {caseRef}.",
  engagement_sent: "{actorName} sent engagement terms for {caseRef}.",
  engagement_signed: "{actorName} signed the engagement for {caseRef}. The case is now active.",
  engagement_declined: "{actorName} declined the engagement for {caseRef}.",
  case_closed: "{caseRef} has been closed by {actorName}.",
};
```
(Interpolate `{actorName}`/`{caseRef}` at render time.)

- [ ] **Step 6: Write `render.ts`**

`packages/email/src/render.ts`:
```ts
import { render } from "@react-email/render";
import * as React from "react";
import type { EmailKind, EmailMessage } from "@ligala/shared/schemas";
import { AuthVerify } from "./templates/auth-verify";
import { AuthReset } from "./templates/auth-reset";
import { InvoiceSent } from "./templates/invoice-sent";
import { PaymentReceipt } from "./templates/payment-receipt";
import { CaseStatus } from "./templates/case-status";
import { SubscriptionReceipt } from "./templates/subscription-receipt";

type DataFor<K extends EmailKind> = Extract<EmailMessage, { kind: K }>["data"];

const COMPONENT = {
  auth_verify: AuthVerify, auth_reset: AuthReset, invoice_sent: InvoiceSent,
  payment_receipt: PaymentReceipt, case_status: CaseStatus, subscription_receipt: SubscriptionReceipt,
} as const;

const SUBJECT: Record<EmailKind, (d: never) => string> = {
  auth_verify: () => "Verify your Ligala email",
  auth_reset: () => "Reset your Ligala password",
  invoice_sent: (d: DataFor<"invoice_sent">) => `Invoice ${d.invoiceNumber} from ${d.lawyerName}`,
  payment_receipt: (d: DataFor<"payment_receipt">) => `Payment received — invoice ${d.invoiceNumber}`,
  case_status: (d: DataFor<"case_status">) => `Update on ${d.caseRef}`,
  subscription_receipt: (d: DataFor<"subscription_receipt">) => `Your Ligala subscription receipt — ${d.invoiceNumber}`,
} as never;

export async function renderEmail<K extends EmailKind>(
  kind: K, data: DataFor<K>,
): Promise<{ subject: string; html: string; text: string }> {
  const Component = COMPONENT[kind] as (p: DataFor<K>) => React.ReactElement;
  const element = Component(data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = (SUBJECT[kind] as (d: DataFor<K>) => string)(data);
  return { subject, html, text };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @ligala/email test`
Expected: PASS (render + queue suites). Then `pnpm --filter @ligala/email typecheck` → PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/email/src/templates packages/email/src/render.ts packages/email/src/render.test.ts
git commit -m "feat(email): add React Email templates + renderEmail"
```

---

## Task 5: Extract `bootstrapEnv` to `@ligala/db` (shared by API + worker)

The worker needs the same Secrets-Manager → `DATABASE_URL` bootstrap the API uses, but can't import from `apps/api`. Move it to `@ligala/db` and re-export.

**Files:**
- Create: `packages/db/src/bootstrap-env.ts` (moved content)
- Modify: `packages/db/src/index.ts` (export it), `apps/api/src/lib/bootstrap-env.ts` (re-export)
- Verify: `@aws-sdk/client-secrets-manager` is a dependency of `@ligala/db` (add if missing)

- [ ] **Step 1: Move the implementation**

Copy the full body of `apps/api/src/lib/bootstrap-env.ts` (read it) into `packages/db/src/bootstrap-env.ts` unchanged.

- [ ] **Step 2: Ensure the dependency**

Check `packages/db/package.json` for `@aws-sdk/client-secrets-manager`. If absent, add `"@aws-sdk/client-secrets-manager": "^3.700.0"` to `dependencies` and run `pnpm install`.

- [ ] **Step 3: Export from db index**

Add to `packages/db/src/index.ts`:
```ts
export { bootstrapEnv } from "./bootstrap-env";
```

- [ ] **Step 4: Re-export from the API location (keep existing imports working)**

Replace the body of `apps/api/src/lib/bootstrap-env.ts` with:
```ts
export { bootstrapEnv } from "@ligala/db";
```

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @ligala/db typecheck && pnpm --filter @ligala/api typecheck`
Expected: PASS (the API still imports `bootstrapEnv` from `./lib/bootstrap-env`).
```bash
git add packages/db/src/bootstrap-env.ts packages/db/src/index.ts packages/db/package.json apps/api/src/lib/bootstrap-env.ts pnpm-lock.yaml
git commit -m "refactor(db): hoist bootstrapEnv to @ligala/db for worker reuse"
```

---

## Task 6: `workers/email` handler implementation

**Files:**
- Modify: `workers/email/handler.ts`
- Create: `workers/email/handler.test.ts`
- Verify: `workers/package.json` already has `@aws-sdk/client-ses`, `@ligala/email`, `@ligala/db`, `@ligala/shared` (it does — add `@ligala/shared` if missing).

- [ ] **Step 1: Write the failing test**

`workers/email/handler.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sesSend = vi.fn();
vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn(() => ({ send: sesSend })),
  SendEmailCommand: vi.fn((input) => ({ input })),
}));

const logRow = { status: "queued" as string };
const findFirst = vi.fn(async () => ({ ...logRow }));
const update = vi.fn(() => ({ set: () => ({ where: vi.fn(async () => {}) }) }));
vi.mock("@ligala/db", () => ({
  bootstrapEnv: vi.fn(async () => {}),
  db: () => ({ query: { emailLog: { findFirst } }, update, insert: () => ({ values: () => ({ onConflictDoNothing: vi.fn(async () => {}) }) }) }),
  schema: { emailLog: { dedupeKey: "dedupe_key" } },
}));
vi.mock("@ligala/email", () => ({ renderEmail: vi.fn(async () => ({ subject: "S", html: "<p>h</p>", text: "h" })) }));

import { handler } from "./handler";

function record(body: unknown, messageId = "m1") {
  return { messageId, body: JSON.stringify(body) } as never;
}
const good = { kind: "auth_verify", to: "a@b.com", dedupeKey: "k1", data: { name: "A", verifyUrl: "https://x/v" } };

beforeEach(() => { sesSend.mockReset(); findFirst.mockReset(); process.env.EMAIL_FROM = "no-reply@mymunus.com"; });

describe("email worker", () => {
  it("sends and returns no failures on success", async () => {
    findFirst.mockResolvedValue({ status: "queued" });
    sesSend.mockResolvedValue({ MessageId: "ses-1" });
    const res = await handler({ Records: [record(good)] } as never);
    expect(sesSend).toHaveBeenCalledTimes(1);
    expect(res.batchItemFailures).toEqual([]);
  });

  it("skips when already sent (dedupe)", async () => {
    findFirst.mockResolvedValue({ status: "sent" });
    const res = await handler({ Records: [record(good)] } as never);
    expect(sesSend).not.toHaveBeenCalled();
    expect(res.batchItemFailures).toEqual([]);
  });

  it("reports the record as a failure when SES throws", async () => {
    findFirst.mockResolvedValue({ status: "queued" });
    sesSend.mockRejectedValue(new Error("ses down"));
    const res = await handler({ Records: [record(good, "m9")] } as never);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m9" }]);
  });

  it("reports malformed bodies as failures", async () => {
    const res = await handler({ Records: [record({ kind: "bogus" }, "mX")] } as never);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "mX" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ligala/workers test -- email/handler`
Expected: FAIL — current handler is a no-op (returns `[]`, never calls SES), so the success + SES-error + malformed assertions fail.

- [ ] **Step 3: Implement the handler**

`workers/email/handler.ts`:
```ts
import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { eq } from "drizzle-orm";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { bootstrapEnv, db, schema } from "@ligala/db";
import { renderEmail } from "@ligala/email";
import { emailMessage } from "@ligala/shared/schemas";

let ses: SESClient | null = null;
function client(): SESClient {
  if (!ses) ses = new SESClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return ses;
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  await bootstrapEnv();
  const failures: { itemIdentifier: string }[] = [];

  for (const r of event.Records) {
    try {
      const parsed = emailMessage.safeParse(JSON.parse(r.body));
      if (!parsed.success) {
        console.error("[email-worker] invalid message", r.messageId, parsed.error.flatten());
        failures.push({ itemIdentifier: r.messageId });
        continue;
      }
      const msg = parsed.data;
      const conn = db();

      const existing = await conn.query.emailLog.findFirst({ where: eq(schema.emailLog.dedupeKey, msg.dedupeKey) });
      if (existing?.status === "sent") continue; // duplicate delivery

      const { subject, html, text } = await renderEmail(msg.kind, msg.data as never);
      const out = await client().send(new SendEmailCommand({
        Source: process.env.EMAIL_FROM ?? "no-reply@mymunus.com",
        Destination: { ToAddresses: [msg.to] },
        ReplyToAddresses: [process.env.EMAIL_REPLY_TO ?? "support@mymunus.com"],
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
        },
      }));

      await conn.update(schema.emailLog)
        .set({ status: "sent", providerMessageId: out.MessageId ?? null, sentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.emailLog.dedupeKey, msg.dedupeKey));
    } catch (err) {
      console.error("[email-worker] send failed", r.messageId, err);
      try {
        const body = JSON.parse(r.body) as { dedupeKey?: string };
        if (body.dedupeKey) {
          await db().update(schema.emailLog)
            .set({ status: "failed", error: String(err).slice(0, 500), updatedAt: new Date() })
            .where(eq(schema.emailLog.dedupeKey, body.dedupeKey));
        }
      } catch { /* ignore secondary failure */ }
      failures.push({ itemIdentifier: r.messageId });
    }
  }

  return { batchItemFailures: failures };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ligala/workers test -- email/handler`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + build + commit**

Run: `pnpm --filter @ligala/workers typecheck && pnpm --filter @ligala/workers build`
Expected: PASS; `workers/dist/email/handler.js` emitted.
```bash
git add workers/email/handler.ts workers/email/handler.test.ts workers/package.json
git commit -m "feat(workers): implement email worker (render + SES + email_log)"
```

---

## Task 7: Better Auth hooks + env-gated `requireEmailVerification`

**Files:**
- Modify: `packages/auth/src/index.ts`, `packages/auth/package.json` (add `@ligala/email` if not present)
- Test: `packages/auth/src/index.test.ts` (or a focused hook test)

- [ ] **Step 1: Write the failing test (hook enqueues)**

`packages/auth/src/email-hooks.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
const dispatch = vi.fn(async () => {});
vi.mock("@ligala/email", () => ({ dispatchEmail: dispatch }));
import { buildVerificationMessage, buildResetMessage } from "./email-hooks";

describe("auth email hooks", () => {
  it("builds an auth_verify message keyed by user + token", () => {
    const m = buildVerificationMessage({ id: "u1", email: "a@b.com", name: "Ana" }, "https://x/verify?token=abc123");
    expect(m.kind).toBe("auth_verify");
    expect(m.to).toBe("a@b.com");
    expect(m.dedupeKey.startsWith("auth_verify:u1:")).toBe(true);
    expect(m.data.verifyUrl).toContain("token=abc123");
  });
  it("builds an auth_reset message", () => {
    const m = buildResetMessage({ id: "u2", email: "c@d.com", name: "Ben" }, "https://x/reset?token=z");
    expect(m.kind).toBe("auth_reset");
    expect(m.dedupeKey.startsWith("auth_reset:u2:")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ligala/auth test -- email-hooks`
Expected: FAIL — `Cannot find module './email-hooks'`.

- [ ] **Step 3: Implement the message builders**

`packages/auth/src/email-hooks.ts`:
```ts
import { createHash } from "node:crypto";
import type { EmailMessage } from "@ligala/shared/schemas";

function tokenHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}
type U = { id: string; email: string; name?: string | null };

export function buildVerificationMessage(user: U, url: string): Extract<EmailMessage, { kind: "auth_verify" }> {
  return { kind: "auth_verify", to: user.email, dedupeKey: `auth_verify:${user.id}:${tokenHash(url)}`, data: { name: user.name ?? "there", verifyUrl: url } };
}
export function buildResetMessage(user: U, url: string): Extract<EmailMessage, { kind: "auth_reset" }> {
  return { kind: "auth_reset", to: user.email, dedupeKey: `auth_reset:${user.id}:${tokenHash(url)}`, data: { name: user.name ?? "there", resetUrl: url } };
}
```

- [ ] **Step 4: Wire the hooks into the Better Auth config**

In `packages/auth/src/index.ts`, add the import at top:
```ts
import { dispatchEmail } from "@ligala/email";
import { buildVerificationMessage, buildResetMessage } from "./email-hooks";
```
Change the `emailAndPassword` block to read `requireEmailVerification` from env and add `sendResetPassword`:
```ts
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.EMAIL_VERIFICATION_REQUIRED === "true",
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await dispatchEmail(buildResetMessage(user, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await dispatchEmail(buildVerificationMessage(user, url));
    },
  },
```
Add `@ligala/email` to `packages/auth/package.json` dependencies if missing (`"@ligala/email": "workspace:*"`) and `pnpm install`.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @ligala/auth test -- email-hooks && pnpm --filter @ligala/auth typecheck`
Expected: PASS. `requireEmailVerification` is now `false` unless `EMAIL_VERIFICATION_REQUIRED=true` (it stays off until Task 12's follow-up).

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/email-hooks.ts packages/auth/src/email-hooks.test.ts packages/auth/src/index.ts packages/auth/package.json pnpm-lock.yaml
git commit -m "feat(auth): enqueue verification + reset emails via hooks (env-gated requirement)"
```

---

## Task 8: API env additions + dev-verify route

**Files:**
- Modify: `apps/api/src/lib/env.ts`
- Modify: `apps/api/src/routes/clients.ts` (add the dev route to the existing `/accounts` router) — OR create `apps/api/src/routes/dev-accounts.ts` and mount it. This plan adds it to the existing accounts router (`clients.ts`, mounted at `/accounts`).
- Test: `apps/api/src/routes/dev-verify.test.ts`

- [ ] **Step 1: Add env vars**

Edit `apps/api/src/lib/env.ts` `schema` object, add:
```ts
  EMAIL_QUEUE_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@mymunus.com"),
  EMAIL_REPLY_TO: z.string().default("support@mymunus.com"),
  EMAIL_VERIFICATION_REQUIRED: z.enum(["true", "false"]).default("false"),
  EMAIL_DEV_VERIFY_ENABLED: z.enum(["true", "false"]).default("false"),
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/routes/dev-verify.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
// follow the existing route-test harness in this repo (see another *.test.ts under routes/)
// Assert: with EMAIL_DEV_VERIFY_ENABLED!="true" → 404; with "true" + a known userId → 200 and emailVerified set true.
```
Fill this in matching the existing route-test setup (find a sibling `routes/*.test.ts` and mirror its app-bootstrap + db mock). Two cases: gate off → 404; gate on → 200 + user row `emailVerified=true`.

- [ ] **Step 3: Implement the dev route**

In `apps/api/src/routes/clients.ts`, add (guarded by env, mirroring the `/files/_dev/*` + `/billing/dev/*` precedent):
```ts
import { env } from "../lib/env";
// inside the accounts router chain:
  .post("/_dev/verify-email", async (c) => {
    if (env().EMAIL_DEV_VERIFY_ENABLED !== "true") {
      return c.json({ message: "not_found" }, 404);
    }
    const user = c.get("user"); // requireSession already applied on this router
    await db().update(schema.user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(schema.user.id, user.id));
    return c.json({ ok: true });
  })
```
(If the accounts router doesn't already apply `requireSession`, accept an `{ email }` body and look the user up instead — match the router's auth posture.)

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm --filter @ligala/api test -- dev-verify && pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/env.ts apps/api/src/routes/clients.ts apps/api/src/routes/dev-verify.test.ts
git commit -m "feat(api): email env vars + env-gated dev verify-email route"
```

---

## Task 9: Producer wiring — billing (invoice_sent, payment_receipt, subscription_receipt)

**Files:**
- Modify: `apps/api/src/routes/billing.ts` (invoice send) and the `applyPaymentWebhook` location (`apps/api/src/routes/webhooks.ts` or `apps/api/src/lib/*`)
- Test: add cases to the existing billing/webhook test suite

First **read** `apps/api/src/routes/billing.ts` (the `/invoices/:id/send` handler) and `applyPaymentWebhook` to find the exact post-commit point and the fields available (invoice number, client/lawyer ids + emails, amounts in cents, `invoice.kind`). Money formatting: reuse the existing cents→string helper if one exists; otherwise format as `₱` + `(cents/100).toLocaleString("en-PH", { minimumFractionDigits: 2 })`.

- [ ] **Step 1: Write failing tests**

Add to the billing/webhook test suite:
- After `/invoices/:id/send` succeeds, `dispatchEmail` is called once with `kind:"invoice_sent"`, `to` = client email, `dedupeKey` = `invoice_sent:<invoiceId>`.
- After a successful **case-invoice** payment webhook, `dispatchEmail` called with `kind:"payment_receipt"`, `to` = client email, `dedupeKey` = `payment_receipt:<paymentId>`.
- After a successful **subscription-invoice** payment webhook, `dispatchEmail` called with `kind:"subscription_receipt"`, `to` = lawyer email, `dedupeKey` = `subscription_receipt:<paymentId>`.

Mock `@ligala/email`'s `dispatchEmail`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @ligala/api test -- billing`
Expected: FAIL — `dispatchEmail` not yet called.

- [ ] **Step 3: Wire `invoice_sent`**

In `/invoices/:id/send`, after the status flips to `sent` and the row is persisted, before returning:
```ts
import { dispatchEmail } from "@ligala/email";
// ...
await dispatchEmail({
  kind: "invoice_sent",
  to: clientEmail,
  dedupeKey: `invoice_sent:${invoice.id}`,
  data: {
    clientName, lawyerName, invoiceNumber: invoice.number,
    amountFormatted: formatPhp(invoice.totalCents), currency: invoice.currency,
    invoiceUrl: `${env().BETTER_AUTH_URL}/invoices/${invoice.id}`,
  },
});
```
(Look up client + lawyer name/email from the existing query context; add a minimal join/read if needed.)

- [ ] **Step 4: Wire receipts in `applyPaymentWebhook`**

After a payment is recorded successful and the invoice flips to `paid`/`partially_paid`, branch on `invoice.kind`:
```ts
if (invoice.kind === "subscription") {
  await dispatchEmail({
    kind: "subscription_receipt", to: lawyerEmail, dedupeKey: `subscription_receipt:${payment.id}`,
    data: { lawyerName, invoiceNumber: invoice.number, amountFormatted: formatPhp(payment.amountCents), currency: invoice.currency, periodEndFormatted: formatDate(subscription.currentPeriodEndsAt), subscriptionUrl: `${env().BETTER_AUTH_URL}/lawyer/subscribe` },
  });
} else {
  await dispatchEmail({
    kind: "payment_receipt", to: clientEmail, dedupeKey: `payment_receipt:${payment.id}`,
    data: { clientName, invoiceNumber: invoice.number, amountPaidFormatted: formatPhp(payment.amountCents), currency: invoice.currency, paidAtFormatted: formatDate(new Date()), invoiceUrl: `${env().BETTER_AUTH_URL}/invoices/${invoice.id}` },
  });
}
```
Add small `formatPhp(cents)` + `formatDate(d)` helpers in `apps/api/src/lib/format.ts` (or reuse existing). Because the webhook is replay-idempotent and `dedupeKey` is keyed on `payment.id`, receipts never double-send.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @ligala/api test -- billing && pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/routes/webhooks.ts apps/api/src/lib/format.ts
git commit -m "feat(api): enqueue invoice-sent + payment/subscription receipt emails"
```

---

## Task 10: Producer wiring — cases & engagements (case_status)

**Files:**
- Modify: `apps/api/src/routes/cases.ts`, `apps/api/src/routes/engagements.ts`
- Test: add cases to those suites

First **read** both routers to find each state-transition point and the available actor/recipient identities. Use the `case_activity` row id created at each transition as the `dedupeKey` suffix (`case_status:<activityId>`).

- [ ] **Step 1: Write failing tests**

For each transition in spec §6, assert `dispatchEmail` is called once with `kind:"case_status"`, the correct `event`, the correct recipient (counterparty), and `dedupeKey = case_status:<activityId>`. Triggers → recipient → event:

| Handler | event | recipient |
|---|---|---|
| `/cases` POST (create) | `case_created` | lawyer |
| `/cases/:id/decision` accept | `case_accepted` | client |
| `/cases/:id/decision` decline | `case_declined` | client |
| `/engagements/cases/:caseId` (send) | `engagement_sent` | client |
| `/engagements/:id/decision` sign | `engagement_signed` | lawyer |
| `/engagements/:id/decision` decline | `engagement_declined` | lawyer |
| `/cases/:id/close` | `case_closed` | the other party |

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @ligala/api test -- cases` then `-- engagements`
Expected: FAIL.

- [ ] **Step 3: Implement**

At each transition, after the `case_activity` row is written, enqueue. Example (case create → notify lawyer):
```ts
import { dispatchEmail } from "@ligala/email";
// after inserting the case_activity row `activity`:
await dispatchEmail({
  kind: "case_status", to: lawyerEmail, dedupeKey: `case_status:${activity.id}`,
  data: { recipientName: lawyerName, caseRef: `Case ${caseRow.referenceOrTitle}`, event: "case_created", actorName: clientName, caseUrl: `${env().BETTER_AUTH_URL}/lawyer/cases/${caseRow.id}` },
});
```
Repeat for each transition with the event/recipient from the table. Use `${BETTER_AUTH_URL}/cases/<id>` for client recipients and `/lawyer/cases/<id>` for lawyer recipients. `caseRef` = the case's human reference (title or short id — match what the case detail UI shows).

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @ligala/api test -- cases && pnpm --filter @ligala/api test -- engagements && pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/cases.ts apps/api/src/routes/engagements.ts
git commit -m "feat(api): enqueue case-status emails on case/engagement transitions"
```

---

## Task 11: Infra — SQS queue + DLQ + worker Lambda + event source + IAM + Monitoring

**Files:**
- Modify: `infra/lib/app-stack.ts`
- Verify: `infra/lib/monitoring.ts` has `attachDlqDepth` (add if missing, mirroring the other `attach*` factories)

- [ ] **Step 1: Confirm the worker build is packaged**

Confirm `apps/api/scripts/build.mjs` and/or the workers build emits `workers/dist/email/handler.js`. The CDK asset for the worker is `workers/dist`. If the deploy pipeline only builds `apps/api`, add `pnpm --filter @ligala/workers build` to the deploy/build step (`.github/workflows/deploy-dev.yml` and the local `cdk:deploy` path). Verify locally: `pnpm --filter @ligala/workers build && ls workers/dist/email/handler.js`.

- [ ] **Step 2: Add the queue, DLQ, worker, and wiring**

In `infra/lib/app-stack.ts`, add imports:
```ts
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
```
After the API Lambda block (and before/after Monitoring calls, consistent with the convention), add:
```ts
// ── Email queue + worker ───────────────────────────────────────────────
const emailDlq = new sqs.Queue(this, "EmailDlq", {
  queueName: `ligala-v2-${props.envName}-email-dlq`,
  retentionPeriod: Duration.days(14),
});
const emailQueue = new sqs.Queue(this, "EmailQueue", {
  queueName: `ligala-v2-${props.envName}-email`,
  visibilityTimeout: Duration.seconds(60), // > worker timeout
  deadLetterQueue: { queue: emailDlq, maxReceiveCount: 3 },
});

const emailWorker = new lambda.Function(this, "EmailWorker", {
  functionName: `ligala-v2-${props.envName}-email-worker`,
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64,
  handler: "email/handler.handler",
  code: lambda.Code.fromAsset(path.resolve(__dirname, "../../workers/dist")),
  memorySize: 512,
  timeout: Duration.seconds(30),
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [props.dbClientSecurityGroup],
  environment: {
    ...commonEnv,
    EMAIL_FROM: "no-reply@mymunus.com",
    EMAIL_REPLY_TO: "support@mymunus.com",
  },
  logRetention: logs.RetentionDays.ONE_MONTH,
});
emailWorker.addEventSource(new SqsEventSource(emailQueue, { batchSize: 10, reportBatchItemFailures: true }));

// Worker needs DB creds + app secret (bootstrapEnv) + SES send.
props.dbCluster.secret!.grantRead(emailWorker);
props.appSecret.grantRead(emailWorker);
emailWorker.addToRolePolicy(new iam.PolicyStatement({
  actions: ["ses:SendEmail", "ses:SendRawEmail"],
  resources: [`arn:aws:ses:${this.region}:${this.account}:identity/mymunus.com`],
}));

// API Lambda produces to the queue.
emailQueue.grantSendMessages(this.apiLambda);
this.apiLambda.addEnvironment("EMAIL_QUEUE_URL", emailQueue.queueUrl);

// Monitoring (per the "attach on the line the resource is created" convention).
this.monitoring.attachLambdaErrors(emailWorker, "email-worker");
this.monitoring.attachLambdaThrottles(emailWorker, "email-worker");
this.monitoring.attachLambdaDurationP95(emailWorker, "email-worker", 5000);
this.monitoring.attachDlqDepth(emailDlq, "email-dlq");
```

- [ ] **Step 3: Add a CfnOutput (optional, for smoke)**

```ts
new CfnOutput(this, "EmailQueueUrl", { value: emailQueue.queueUrl });
```

- [ ] **Step 4: Synth to verify**

Run: `pnpm cdk:synth`
Expected: synth succeeds; the template shows `EmailQueue`, `EmailDlq`, `EmailWorker`, the event-source mapping, and the new alarms. Confirm no diff errors. (`attachDlqDepth` must exist in `monitoring.ts` — if synth errors on it, add the factory mirroring `attachLambdaErrors`, alarming on the DLQ `ApproximateNumberOfMessagesVisible >= 1`.)

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @ligala/infra typecheck`
Expected: PASS.
```bash
git add infra/lib/app-stack.ts infra/lib/monitoring.ts
git commit -m "feat(infra): email SQS queue + DLQ + worker Lambda + alarms"
```

---

## Task 12: Deploy, post-deploy smoke, then flip hard verification

**Files:** none (ops) — except the env flip is a config change.

- [ ] **Step 1: Full verification before deploy**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green across the workspace (9 packages). Fix anything red before deploying.

- [ ] **Step 2: Deploy**

Push to `develop` (GHA OIDC auto-deploys) **or** `pnpm cdk:deploy:dev`. Confirm the migration Lambda ran the `email_log` migration (invoke with `{"action":"migrate"}` if migrations aren't auto-applied on deploy — check the existing deploy flow). Confirm the new queue + worker exist:
```
aws sqs get-queue-url --queue-name ligala-v2-dev-email --region ap-southeast-1
aws lambda get-function --function-name ligala-v2-dev-email-worker --region ap-southeast-1
```

- [ ] **Step 3: Smoke one real send**

Trigger an event whose producer is wired — e.g. send an invoice from a test lawyer to a test client (reuse the PayMongo-smoke setup pattern), or trigger a password reset. Then verify:
```
# email_log row went sent with a SES MessageId:
# (query via the migrate/admin path or a temporary read) — expect status=sent, provider_message_id set.
```
Confirm the recipient inbox received it (use a real test inbox you control). Check the DLQ is empty: `aws sqs get-queue-attributes --queue-url <email-dlq-url> --attribute-names ApproximateNumberOfMessages`.

- [ ] **Step 4: Flip hard verification (follow-up)**

Once a send is confirmed end-to-end, set `EMAIL_VERIFICATION_REQUIRED=true` on the API Lambda (via the app secret / env) and redeploy. Set `EMAIL_DEV_VERIFY_ENABLED=true` on the **dev** API Lambda so automation can self-verify.

- [ ] **Step 5: Fix the Playwright signup spec**

Update `tests/e2e/helpers.ts` `signUp()` to call `POST /accounts/_dev/verify-email` after signup (so the session becomes usable under hard verification). Run: `PLAYWRIGHT_BASE_URL=… PLAYWRIGHT_API_URL=… pnpm test:e2e`. Expected: green.

- [ ] **Step 6: Update PROCESS.md + commit**

Mark the email pipeline landed in `PROCESS.md` (Phase 8), note hard verification is on, the dev-verify route, and that the expiry-reminder scanner + custom bounce/complaint suppression remain deferred.
```bash
git add PROCESS.md
git commit -m "docs: email pipeline landed; hard email verification enabled"
```

---

## Self-Review notes

- **Spec coverage:** §3 pipeline → Tasks 1,3,6,11; §4 components → all tasks; §5 message+`email_log` → Tasks 1,2; §6 producers → Tasks 7,9,10; §7 worker algorithm → Task 6; §8 error handling → Tasks 6,11; §9 infra → Task 11; §10 env → Tasks 7,8,11; §11 sequencing+dev-verify → Tasks 8,12; §12 testing → per-task tests. Deferred items (§2) intentionally absent.
- **Type consistency:** `EmailMessage`/`EmailKind` (Task 2) reused in Tasks 3,4,6,7; `dispatchEmail`/`enqueueEmail`/`renderEmail` names stable across Tasks 3,4,6,7,9,10; `emailLog`/`emailStatus`/`emailKind` schema names stable across Tasks 1,3,6.
- **Open reads flagged for the implementer:** the exact route-test harness (Task 8), the `applyPaymentWebhook` body + identity lookups (Task 9), and the case/engagement transition points + activity-row ids (Task 10) must be read in-repo before writing those tasks' code — the plan gives the precise enqueue payloads, dedupeKeys, recipients, and trigger points for each.

# Lawyer Payouts (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend for collecting client payments into a per-lawyer balance and disbursing withdrawals to GCash/Maya/bank via PayMongo Disbursements, with full pass-through of the legal fee (no platform commission).

**Architecture:** A new self-contained `payouts` aggregate (`schema` + `shared` + `route`). All money/clearing/refund math lives in pure functions in `apps/api/src/lib/payouts.ts` (TDD'd directly). The balance is **computed from an append-only `balance_entry` ledger** (available vs pending via each entry's `clears_at`) — no denormalized balance table and no scheduled clearing worker in v1 (per spec §11). `applyPaymentWebhook` credits earnings on case-invoice payments; `refundPayment` reverses them. Withdrawals create a `payout` row, debit the ledger, and call PayMongo `POST /v2/batch_transfers`; a signature-verified transfer webhook reconciles status and re-credits on failure/return. A `dev_simulate` transfer path mirrors the existing `/billing/dev` stub so the flow runs locally without live disbursement keys.

**Tech Stack:** Drizzle (Postgres), Hono, Zod, vitest, PayMongo Money Movement API.

**Spec:** `docs/superpowers/specs/2026-05-26-lawyer-payouts-design.md`

**Out of scope (→ Plan 2):** lawyer "Earnings/Payouts" web portal page, payout-method form, Server Actions, admin payout-queue views, denormalized `lawyer_balance` table, EventBridge clearing scanner, provider-side refund execution.

**Conventions to honor (from CLAUDE.md):** money is integer cents; `noUncheckedIndexedAccess` is on (handle `T | undefined`, no `!`); `import type` for type-only imports; new api env vars go in `apps/api/src/lib/env.ts`; admin mutations need an audited `reason`; webhook idempotency via a unique `(provider, providerXId)` index.

---

## ⚠️ Sandbox-verification gates (do NOT skip — from spec §14)

Two tasks below (Task 6 `createBatchTransfer`, Task 12 transfer webhook) implement a **best-effort** shape of PayMongo's Disbursements API. Before wiring real keys in a deployed env, confirm against the PayMongo sandbox: (a) exact `Idempotency-Key` header on `/v2/batch_transfers`; (b) the `source_account` requirement + your wallet's account/BIC; (c) whether GCash routes via InstaPay vs PESONet; (d) transfer webhook event names + signature scheme; (e) that the collection `fee` is present on the `checkout_session.payment.paid` payload (Task 8). The `dev_simulate` path makes every other task fully testable without this.

---

## Task 1: Payouts schema (enums + 3 tables)

**Files:**
- Create: `packages/db/src/schema/payouts.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

```ts
// packages/db/src/schema/payouts.ts
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { payments } from "./billing";

/**
 * Append-only per-lawyer balance ledger. The withdrawable balance is COMPUTED
 * from these rows (no denormalized total in v1): `available` = signed sum of
 * entries whose `clears_at <= now`, `pending` = signed sum of the rest.
 *
 *   earning        credit  +gross                  clears_at = now + clearing window
 *   processing_fee debit   -PayMongo collection fee clears_at = now + clearing window (clears WITH its earning)
 *   payout         debit   -(withdrawal - fee)      clears_at = now (immediate)
 *   payout_fee     debit   -PHP 10                  clears_at = now (immediate)
 *   refund_reversal debit  -net previously credited clears_at = now (immediate; may drive available negative)
 *   adjustment     either  admin correction         clears_at = now
 */
export const balanceEntryKind = pgEnum("balance_entry_kind", [
  "earning",
  "processing_fee",
  "payout",
  "payout_fee",
  "refund_reversal",
  "adjustment",
]);

export const balanceEntryDirection = pgEnum("balance_entry_direction", [
  "credit",
  "debit",
]);

export const balanceEntries = pgTable("balance_entry", {
  id: text("id").primaryKey(),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  kind: balanceEntryKind("kind").notNull(),
  direction: balanceEntryDirection("direction").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").default("PHP").notNull(),
  clearsAt: timestamp("clears_at", { withTimezone: true }).notNull(),
  relatedPaymentId: text("related_payment_id").references(() => payments.id, {
    onDelete: "set null",
  }),
  // FK added after `payouts` is declared below (self-reference ordering).
  relatedPayoutId: text("related_payout_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const payoutMethodType = pgEnum("payout_method_type", [
  "gcash",
  "maya",
  "bank",
]);

export const lawyerPayoutMethods = pgTable("lawyer_payout_method", {
  id: text("id").primaryKey(),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: payoutMethodType("type").notNull(),
  // Mobile number (09XXXXXXXXX) for e-wallets; account number for bank.
  accountNumber: text("account_number").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  // PayMongo institution / BIC code — banks only.
  bankBic: text("bank_bic"),
  isDefault: boolean("is_default").default(false).notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const payoutProvider = pgEnum("payout_provider", [
  "paymongo",
  "dev_simulate",
]);

export const payoutStatus = pgEnum("payout_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "returned",
]);

export const payouts = pgTable(
  "payout",
  {
    id: text("id").primaryKey(),
    lawyerId: text("lawyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    payoutMethodId: text("payout_method_id")
      .notNull()
      .references(() => lawyerPayoutMethods.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(), // requested gross debited from balance
    feeCents: integer("fee_cents").default(1000).notNull(), // PHP 10
    netCents: integer("net_cents").notNull(), // amount - fee, actually disbursed
    currency: text("currency").default("PHP").notNull(),
    provider: payoutProvider("provider").notNull(),
    providerTransferId: text("provider_transfer_id"),
    status: payoutStatus("status").default("pending").notNull(),
    failureReason: text("failure_reason"),
    // Immutable destination details captured at request time.
    destinationSnapshot: jsonb("destination_snapshot").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    providerTransferUnique: uniqueIndex("payout_provider_transfer_id_unique").on(
      t.provider,
      t.providerTransferId,
    ),
  }),
);

export type BalanceEntry = typeof balanceEntries.$inferSelect;
export type NewBalanceEntry = typeof balanceEntries.$inferInsert;
export type LawyerPayoutMethod = typeof lawyerPayoutMethods.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
```

> Note: `relatedPayoutId` is a plain `text` column (not a declared FK) to avoid a circular table reference — `balance_entry` is declared before `payout`. The application sets it; referential integrity on that link is enforced in code, matching the repo's tolerance for `set null`-style soft links.

- [ ] **Step 2: Register the schema in the barrel**

In `packages/db/src/schema/index.ts`, add after the `subscriptions` line:

```ts
export * from "./payouts";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ligala/db typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/payouts.ts packages/db/src/schema/index.ts
git commit -m "feat(db): payouts schema (balance_entry, payout, lawyer_payout_method)"
```

---

## Task 2: Generate & apply the migration

**Files:**
- Create: `packages/db/drizzle/NNNN_*.sql` (auto-named by drizzle-kit)

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `packages/db/drizzle/NNNN_*.sql` file is written containing `CREATE TYPE` for the new enums and `CREATE TABLE` for `balance_entry`, `lawyer_payout_method`, `payout` + the `payout_provider_transfer_id_unique` index.

- [ ] **Step 2: Inspect the generated SQL**

Open the new file and confirm: 5 new enum types, 3 new tables, the unique index, and FKs to `user`/`payment`/`lawyer_payout_method`. No `DROP`/destructive statements against existing tables.

- [ ] **Step 3: Apply against local Postgres**

Run: `docker compose up -d` (if not already running), then `pnpm db:migrate`
Expected: migration applies cleanly; no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle
git commit -m "feat(db): migration for payouts tables"
```

---

## Task 3: Shared Zod schemas + error codes

**Files:**
- Create: `packages/shared/src/schemas/payouts.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/schemas/payouts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { payoutMethodInput, withdrawalInput } from "./payouts";

describe("payoutMethodInput", () => {
  it("accepts a valid gcash method", () => {
    const r = payoutMethodInput.safeParse({
      type: "gcash",
      accountNumber: "09171234567",
      accountHolderName: "Juan Dela Cruz",
    });
    expect(r.success).toBe(true);
  });

  it("requires bankBic when type is bank", () => {
    const r = payoutMethodInput.safeParse({
      type: "bank",
      accountNumber: "1234567890",
      accountHolderName: "Juan Dela Cruz",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed e-wallet mobile number", () => {
    const r = payoutMethodInput.safeParse({
      type: "maya",
      accountNumber: "12345",
      accountHolderName: "Juan Dela Cruz",
    });
    expect(r.success).toBe(false);
  });
});

describe("withdrawalInput", () => {
  it("accepts a positive integer amount + methodId", () => {
    const r = withdrawalInput.safeParse({ payoutMethodId: "pm_1", amountCents: 50000 });
    expect(r.success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    const r = withdrawalInput.safeParse({ payoutMethodId: "pm_1", amountCents: 0 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ligala/shared test -- payouts`
Expected: FAIL — cannot import from `./payouts` (module not found).

- [ ] **Step 3: Write the schema**

Create `packages/shared/src/schemas/payouts.ts`:

```ts
import { z } from "zod";

/** Stable error codes returned by the payouts API (mirrors billing's string codes). */
export const PAYOUT_ERROR_CODES = [
  "kyc_not_approved",
  "method_not_found",
  "amount_below_minimum",
  "insufficient_balance",
  "amount_invalid",
  "payout_not_found",
  "paymongo_not_configured",
  "paymongo_request_failed",
  "paymongo_unreachable",
] as const;

const ewalletNumber = z
  .string()
  .regex(/^09\d{9}$/, "must be a PH mobile number, e.g. 09171234567");

export const payoutMethodInput = z
  .object({
    type: z.enum(["gcash", "maya", "bank"]),
    accountNumber: z.string().min(1).max(64),
    accountHolderName: z.string().min(1).max(200),
    bankBic: z.string().min(1).max(32).optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "bank") {
      if (!d.bankBic) {
        ctx.addIssue({ code: "custom", path: ["bankBic"], message: "bankBic is required for bank" });
      }
    } else {
      // e-wallet: accountNumber must be a mobile number
      if (!ewalletNumber.safeParse(d.accountNumber).success) {
        ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "must be a PH mobile number" });
      }
    }
  });
export type PayoutMethodInput = z.infer<typeof payoutMethodInput>;

export const withdrawalInput = z.object({
  payoutMethodId: z.string().min(1).max(64),
  amountCents: z.number().int().min(1).max(1_000_000_000),
});
export type WithdrawalInput = z.infer<typeof withdrawalInput>;
```

- [ ] **Step 4: Register in the barrel**

In `packages/shared/src/schemas/index.ts`, add after the `subscriptions` line:

```ts
export * from "./payouts";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ligala/shared test -- payouts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/payouts.ts packages/shared/src/schemas/payouts.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): payout method + withdrawal Zod schemas"
```

---

## Task 4: Pure balance math (`computeBalance`, clearing, signed sum)

**Files:**
- Create: `apps/api/src/lib/payouts.ts`
- Test: `apps/api/src/lib/payouts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/lib/payouts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PAYOUT_FEE_CENTS,
  signedCents,
  computeBalance,
  clearsAtForEarning,
  type LedgerLine,
} from "./payouts";

const DAY = 86_400_000;

describe("signedCents", () => {
  it("is positive for credit, negative for debit", () => {
    expect(signedCents({ direction: "credit", amountCents: 100 })).toBe(100);
    expect(signedCents({ direction: "debit", amountCents: 100 })).toBe(-100);
  });
});

describe("clearsAtForEarning", () => {
  it("adds the clearing window in days", () => {
    const now = new Date("2026-05-26T00:00:00Z");
    expect(clearsAtForEarning(now, 3).toISOString()).toBe("2026-05-29T00:00:00.000Z");
  });
});

describe("computeBalance", () => {
  const now = new Date("2026-05-26T00:00:00Z");

  it("puts a fresh earning (and its fee) in pending, not available", () => {
    const future = new Date(now.getTime() + 3 * DAY);
    const lines: LedgerLine[] = [
      { direction: "credit", amountCents: 10000, clearsAt: future }, // earning
      { direction: "debit", amountCents: 300, clearsAt: future }, // processing_fee
    ];
    expect(computeBalance(lines, now)).toEqual({ availableCents: 0, pendingCents: 9700 });
  });

  it("moves cleared earnings into available", () => {
    const past = new Date(now.getTime() - 1 * DAY);
    const lines: LedgerLine[] = [
      { direction: "credit", amountCents: 10000, clearsAt: past },
      { direction: "debit", amountCents: 300, clearsAt: past },
    ];
    expect(computeBalance(lines, now)).toEqual({ availableCents: 9700, pendingCents: 0 });
  });

  it("immediate debits (payout/refund) reduce available right away and can go negative", () => {
    const past = new Date(now.getTime() - 1 * DAY);
    const lines: LedgerLine[] = [
      { direction: "credit", amountCents: 10000, clearsAt: past },
      { direction: "debit", amountCents: 300, clearsAt: past },
      { direction: "debit", amountCents: 20000, clearsAt: now }, // refund_reversal
    ];
    expect(computeBalance(lines, now)).toEqual({ availableCents: -10300, pendingCents: 0 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @ligala/api test -- lib/payouts`
Expected: FAIL — cannot import `./payouts`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/lib/payouts.ts`:

```ts
/** PayMongo per-transfer disbursement fee: PHP 10.00 = 1000 cents. */
export const PAYOUT_FEE_CENTS = 1000;

export type LedgerLine = {
  direction: "credit" | "debit";
  amountCents: number;
  clearsAt: Date;
};

export function signedCents(e: Pick<LedgerLine, "direction" | "amountCents">): number {
  return e.direction === "credit" ? e.amountCents : -e.amountCents;
}

/** Earnings (and their paired processing fee) clear after the window; everything else is immediate. */
export function clearsAtForEarning(now: Date, clearingDays: number): Date {
  return new Date(now.getTime() + clearingDays * 86_400_000);
}

/**
 * Compute the withdrawable + pending balance from ledger lines.
 *   available = signed sum of lines whose clears_at <= now
 *   pending   = signed sum of the rest
 */
export function computeBalance(
  lines: LedgerLine[],
  now: Date,
): { availableCents: number; pendingCents: number } {
  let availableCents = 0;
  let pendingCents = 0;
  for (const line of lines) {
    const s = signedCents(line);
    if (line.clearsAt.getTime() <= now.getTime()) availableCents += s;
    else pendingCents += s;
  }
  return { availableCents, pendingCents };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ligala/api test -- lib/payouts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/payouts.ts apps/api/src/lib/payouts.test.ts
git commit -m "feat(api): pure balance math (computeBalance + clearing)"
```

---

## Task 5: Pure withdrawal-check + refund-reversal math

**Files:**
- Modify: `apps/api/src/lib/payouts.ts`
- Modify: `apps/api/src/lib/payouts.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `apps/api/src/lib/payouts.test.ts`:

```ts
import { checkWithdrawable, refundReversalCents } from "./payouts";

describe("checkWithdrawable", () => {
  it("ok when amount within min and available", () => {
    expect(checkWithdrawable({ requestCents: 50000, availableCents: 60000, minCents: 50000 }))
      .toEqual({ ok: true });
  });
  it("rejects below the minimum", () => {
    expect(checkWithdrawable({ requestCents: 49999, availableCents: 60000, minCents: 50000 }))
      .toEqual({ ok: false, error: "amount_below_minimum" });
  });
  it("rejects above available", () => {
    expect(checkWithdrawable({ requestCents: 70000, availableCents: 60000, minCents: 50000 }))
      .toEqual({ ok: false, error: "insufficient_balance" });
  });
  it("rejects non-positive", () => {
    expect(checkWithdrawable({ requestCents: 0, availableCents: 60000, minCents: 50000 }))
      .toEqual({ ok: false, error: "amount_invalid" });
  });
});

describe("refundReversalCents", () => {
  it("reverses the NET previously credited, pro-rata to refunded gross", () => {
    // gross 10000, fee 300 => net 9700; full refund => reverse 9700
    expect(refundReversalCents({ grossCents: 10000, processingFeeCents: 300, refundedGrossCents: 10000 }))
      .toBe(9700);
  });
  it("handles a partial refund pro-rata", () => {
    // half the gross refunded => half the net
    expect(refundReversalCents({ grossCents: 10000, processingFeeCents: 300, refundedGrossCents: 5000 }))
      .toBe(4850);
  });
  it("is zero when gross is zero (guard against divide-by-zero)", () => {
    expect(refundReversalCents({ grossCents: 0, processingFeeCents: 0, refundedGrossCents: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ligala/api test -- lib/payouts`
Expected: FAIL — `checkWithdrawable` / `refundReversalCents` not exported.

- [ ] **Step 3: Implement**

Append to `apps/api/src/lib/payouts.ts`:

```ts
export type WithdrawCheck =
  | { ok: true }
  | { ok: false; error: "amount_below_minimum" | "insufficient_balance" | "amount_invalid" };

export function checkWithdrawable(args: {
  requestCents: number;
  availableCents: number;
  minCents: number;
}): WithdrawCheck {
  if (!Number.isInteger(args.requestCents) || args.requestCents <= 0) {
    return { ok: false, error: "amount_invalid" };
  }
  if (args.requestCents < args.minCents) return { ok: false, error: "amount_below_minimum" };
  if (args.requestCents > args.availableCents) return { ok: false, error: "insufficient_balance" };
  return { ok: true };
}

/**
 * Net amount to claw back from a lawyer's balance on refund: the net that was
 * credited (gross - processing fee), pro-rata to the refunded fraction of gross.
 * PayMongo does not return its collection fee on refunds, so we reverse net, not gross.
 */
export function refundReversalCents(args: {
  grossCents: number;
  processingFeeCents: number;
  refundedGrossCents: number;
}): number {
  if (args.grossCents <= 0) return 0;
  const net = args.grossCents - args.processingFeeCents;
  return Math.round(net * (args.refundedGrossCents / args.grossCents));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @ligala/api test -- lib/payouts`
Expected: PASS (all payouts lib tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/payouts.ts apps/api/src/lib/payouts.test.ts
git commit -m "feat(api): withdrawal-check + refund-reversal math"
```

---

## Task 6: PayMongo `createBatchTransfer` (disbursement call)

**Files:**
- Modify: `apps/api/src/lib/paymongo.ts`
- Modify: `apps/api/src/lib/paymongo.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `apps/api/src/lib/paymongo.test.ts` (inside the file, after the existing `describe`s):

```ts
import { createBatchTransfer } from "./paymongo";

describe("createBatchTransfer", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  function mockOnce(body: unknown, status = 200) {
    const fn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    );
    globalThis.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  const OK = { data: [{ id: "tr_test_123", type: "transfer", attributes: { status: "pending" } }] };

  it("posts a single transfer and returns the transfer id", async () => {
    const fetchMock = mockOnce(OK);
    const res = await createBatchTransfer({
      secretKey: "sk_test_x",
      amountCents: 49000,
      currency: "PHP",
      provider: "instapay",
      sourceAccount: { number: "ACCT", name: "Ligala", bic: "SRCBICXX" },
      destination: { number: "09171234567", name: "Juan Dela Cruz", bic: "GXCHPHM2XXX" },
      referenceNumber: "po_abc",
      callbackUrl: "https://app.test/webhooks/paymongo-transfer",
      idempotencyKey: "po_abc",
    });
    expect(res).toEqual({ transferId: "tr_test_123" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.paymongo.com/v2/batch_transfers");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Basic ${Buffer.from("sk_test_x:").toString("base64")}`);
    expect(headers["Idempotency-Key"]).toBe("po_abc");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.data.attributes.transfers[0].amount).toBe(49000);
    expect(sent.data.attributes.transfers[0].destination_account.number).toBe("09171234567");
  });

  it("throws PaymongoApiError on non-2xx", async () => {
    mockOnce({ errors: [{ code: "x" }] }, 422);
    await expect(
      createBatchTransfer({
        secretKey: "sk_test_x", amountCents: 1, currency: "PHP", provider: "instapay",
        sourceAccount: { number: "A", name: "L" }, destination: { number: "0917", name: "J" },
        referenceNumber: "r", callbackUrl: "https://x/cb", idempotencyKey: "r",
      }),
    ).rejects.toBeInstanceOf(PaymongoApiError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ligala/api test -- lib/paymongo`
Expected: FAIL — `createBatchTransfer` not exported.

- [ ] **Step 3: Implement**

Append to `apps/api/src/lib/paymongo.ts`:

```ts
export type BatchTransferAccount = { number: string; name: string; bic?: string };

export type CreateBatchTransferInput = {
  secretKey: string;
  amountCents: number;
  currency: "PHP";
  provider: "instapay" | "pesonet" | "paymongo";
  sourceAccount: BatchTransferAccount;
  destination: BatchTransferAccount;
  referenceNumber: string;
  callbackUrl: string;
  idempotencyKey: string;
};

/**
 * Create a single disbursement via PayMongo Money Movement batch_transfers.
 *
 * NOTE: shape is best-effort and MUST be confirmed against the PayMongo
 * sandbox (see plan's sandbox-verification gates) — specifically the
 * Idempotency-Key header, the source_account requirement, and the response id
 * location. We send one transfer per withdrawal.
 */
export async function createBatchTransfer(
  input: CreateBatchTransferInput,
): Promise<{ transferId: string }> {
  const body = {
    data: {
      attributes: {
        transfers: [
          {
            amount: input.amountCents,
            currency: input.currency,
            provider: input.provider,
            source_account: {
              number: input.sourceAccount.number,
              name: input.sourceAccount.name,
              ...(input.sourceAccount.bic ? { bic: input.sourceAccount.bic } : {}),
            },
            destination_account: {
              number: input.destination.number,
              name: input.destination.name,
              ...(input.destination.bic ? { bic: input.destination.bic } : {}),
            },
            reference_number: input.referenceNumber,
            callback_url: input.callbackUrl,
          },
        ],
      },
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.paymongo.com/v2/batch_transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${input.secretKey}:`).toString("base64")}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new PaymongoUnreachableError(err);
  }

  const text = await res.text();
  if (!res.ok) throw new PaymongoApiError(res.status, text);

  let parsed: { data?: Array<{ id?: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PaymongoApiError(res.status, text);
  }
  const transferId = parsed?.data?.[0]?.id;
  if (!transferId) throw new PaymongoApiError(res.status, text);
  return { transferId };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @ligala/api test -- lib/paymongo`
Expected: PASS (existing + 2 new tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/paymongo.ts apps/api/src/lib/paymongo.test.ts
git commit -m "feat(api): PayMongo createBatchTransfer (disbursement)"
```

---

## Task 7: Env vars for payouts

**Files:**
- Modify: `apps/api/src/lib/env.ts`

- [ ] **Step 1: Add the vars**

In `apps/api/src/lib/env.ts`, add inside the `z.object({ ... })` (after `PAYMONGO_WEBHOOK_SECRET`):

```ts
  // Disbursements / payouts
  PAYMONGO_TRANSFER_WEBHOOK_SECRET: z.string().optional(),
  // Source (platform) wallet account for batch_transfers — confirm in sandbox.
  PAYMONGO_WALLET_ACCOUNT_NUMBER: z.string().optional(),
  PAYMONGO_WALLET_ACCOUNT_NAME: z.string().default("Ligala"),
  PAYMONGO_WALLET_BIC: z.string().optional(),
  // Minimum withdrawal (PHP 500) + clearing window before earnings are withdrawable.
  PAYOUT_MIN_CENTS: z.coerce.number().int().positive().default(50000),
  PAYOUT_CLEARING_DAYS: z.coerce.number().int().min(0).default(3),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/env.ts
git commit -m "feat(api): payout env vars (clearing, minimum, wallet source, transfer webhook secret)"
```

---

## Task 8: Credit the balance on case-invoice payment

**Files:**
- Modify: `apps/api/src/routes/billing.ts` (`applyPaymentWebhook`)

This extends the existing idempotent helper so a successful **case** invoice payment also writes `earning` + `processing_fee` ledger lines. Subscription invoices are untouched. The optional `feeCents` lets the PayMongo webhook pass the real collection fee; `dev_simulate` passes nothing (fee 0).

- [ ] **Step 1: Add `feeCents` to the input type**

In `apps/api/src/routes/billing.ts`, in the `applyPaymentWebhook` parameter type, add a field:

```ts
export async function applyPaymentWebhook(input: {
  provider: "paymongo" | "paypal" | "dev_simulate";
  providerPaymentId: string;
  invoiceId: string;
  status: "succeeded" | "failed";
  amountCents?: number;
  currency?: string;
  failureReason?: string;
  feeCents?: number; // PayMongo collection fee (cents); 0/undefined when unknown
  rawPayload?: unknown;
}) {
```

- [ ] **Step 2: Add the imports**

At the top of `apps/api/src/routes/billing.ts`, add:

```ts
import { clearsAtForEarning } from "../lib/payouts";
```

and ensure `env` is imported (it already is).

- [ ] **Step 3: Write the ledger lines inside the success branch**

In `applyPaymentWebhook`, inside `if (input.status === "succeeded") { ... }`, immediately after the existing `transactions` charge insert, add:

```ts
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
```

> `amount`, `currency`, `now`, `paymentId`, `conn`, and `invoice` are all already in scope at that point in the function.

- [ ] **Step 4: Add a unit test for the credit path**

Create `apps/api/src/routes/payouts-credit.test.ts` following the `billing.email.test.ts` mocking harness (mock `@ligala/db`, `../lib/env`, `../middleware/session`, `@ligala/email`). Assert that calling `applyPaymentWebhook` with a **case** invoice + `feeCents: 300` inserts a `balance_entry` with `kind: "earning"`, `amountCents: <gross>` and a second with `kind: "processing_fee"`, `amountCents: 300`; and that a **subscription** invoice inserts **no** `balance_entry` rows.

```ts
// apps/api/src/routes/payouts-credit.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertValues, mockInsert, mockDb, mockEnvState, invoiceRow } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  const invoiceRow = {
    kind: "case", id: "inv_1", number: "INV-1", lawyerId: "law_1", clientId: "cli_1",
    currency: "PHP", totalCents: 10000, paidCents: 0, appliedDiscountCodeId: null,
  };
  const mockEnvState = { PAYOUT_CLEARING_DAYS: 3, BETTER_AUTH_URL: "https://app.test" };
  const mockDb = {
    query: {
      invoices: { findFirst: vi.fn().mockResolvedValue(invoiceRow) },
      payments: { findFirst: vi.fn().mockResolvedValue(undefined) },
      discountCodes: { findFirst: vi.fn().mockResolvedValue(null) },
      lawyerSubscriptions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      user: { findFirst: vi.fn().mockResolvedValue({ email: "c@x.test", name: "C" }) },
    },
    insert: mockInsert,
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  };
  return { mockInsertValues, mockInsert, mockDb, mockEnvState, invoiceRow };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: {
    invoices: {}, payments: {}, transactions: {}, discountCodes: {},
    lawyerSubscriptions: {}, user: {}, balanceEntries: {},
  },
}));
vi.mock("../lib/env", () => ({ env: () => mockEnvState }));
vi.mock("@ligala/email", () => ({ dispatchEmail: vi.fn().mockResolvedValue(undefined) }));

import { applyPaymentWebhook } from "./billing";

describe("applyPaymentWebhook — lawyer earnings", () => {
  beforeEach(() => {
    mockInsertValues.mockClear();
    mockInsert.mockClear();
    invoiceRow.kind = "case";
  });

  function entriesInserted() {
    return mockInsertValues.mock.calls
      .map((c) => c[0])
      .filter((v) => v && (v.kind === "earning" || v.kind === "processing_fee"));
  }

  it("writes earning + processing_fee for a case invoice", async () => {
    await applyPaymentWebhook({
      provider: "paymongo", providerPaymentId: "pay_1", invoiceId: "inv_1",
      status: "succeeded", amountCents: 10000, feeCents: 300,
    });
    const entries = entriesInserted();
    expect(entries.find((e) => e.kind === "earning")?.amountCents).toBe(10000);
    expect(entries.find((e) => e.kind === "processing_fee")?.amountCents).toBe(300);
  });

  it("writes NO balance entries for a subscription invoice", async () => {
    invoiceRow.kind = "subscription";
    await applyPaymentWebhook({
      provider: "paymongo", providerPaymentId: "pay_2", invoiceId: "inv_1",
      status: "succeeded", amountCents: 10000, feeCents: 300,
    });
    expect(entriesInserted()).toHaveLength(0);
  });
});
```

> If the existing `applyPaymentWebhook` reads other tables/fields not covered by this mock (e.g. subscription period math), extend the `mockDb.query` stubs minimally so the function runs — match whatever the current implementation touches. The assertion of interest is only the `balance_entry` inserts.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ligala/api test -- payouts-credit`
Expected: PASS (2 tests). Then `pnpm --filter @ligala/api test -- billing` to confirm existing billing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/routes/payouts-credit.test.ts
git commit -m "feat(api): credit lawyer balance on case-invoice payment"
```

---

## Task 9: Pass the real collection fee from the PayMongo webhook

**Files:**
- Modify: `apps/api/src/lib/paymongo.ts` (`PaymongoEvent` type — add `fee`/`net_amount`)
- Modify: `apps/api/src/routes/webhooks.ts` (`/paymongo` handler)

- [ ] **Step 1: Extend the event type**

In `apps/api/src/lib/paymongo.ts`, in the inner `attributes` of `PaymongoEvent.data.attributes.data.attributes`, add optional fields:

```ts
          total_amount?: number;
          amount?: number;
          fee?: number;
          net_amount?: number;
          last_payment_error?: { message?: string } | null;
```

- [ ] **Step 2: Read & forward the fee**

In `apps/api/src/routes/webhooks.ts`, in the `/paymongo` handler, after computing `amountCents`, add:

```ts
    const feeCents: number | undefined =
      typeof resource.attributes.fee === "number" ? resource.attributes.fee : undefined;
```

and pass `feeCents` into the `applyPaymentWebhook({ ... })` call.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`
Expected: PASS.

> ⚠️ Sandbox gate: confirm the `fee` field actually rides on the `checkout_session.payment.paid` payload. If it does not, the follow-up is to fetch the payment object by id before crediting — track that as a known issue, not a blocker (credit still works with `feeCents` undefined → fee 0, lawyer simply isn't charged the collection fee).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/paymongo.ts apps/api/src/routes/webhooks.ts
git commit -m "feat(api): forward PayMongo collection fee to balance credit"
```

---

## Task 10: Reverse the balance on refund

**Files:**
- Modify: `apps/api/src/routes/billing.ts` (`refundPayment`)

- [ ] **Step 1: Add imports**

Ensure `apps/api/src/routes/billing.ts` imports `refundReversalCents`:

```ts
import { clearsAtForEarning, refundReversalCents } from "../lib/payouts";
```

- [ ] **Step 2: Write the reversal inside `refundPayment`**

In `refundPayment`, after the existing `transactions` refund insert (the `kind: "refund"` row) and before the invoice roll-back update, add:

```ts
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
```

> `and`, `eq`, `conn`, `payment`, `invoice`, `now` are already in scope (the function already imports `and`/`eq` and loads `invoice`).

- [ ] **Step 3: Add a unit test**

Create `apps/api/src/routes/payouts-refund.test.ts` mirroring the Task 8 harness. Stub `db().query.payments.findFirst` → a succeeded payment (`amountCents: 10000`, `refundedCents: 0`, `currency: "PHP"`), `db().query.invoices.findFirst` → a `case` invoice, and `db().query.balanceEntries.findFirst` → `{ amountCents: 300 }`. Assert calling `refundPayment({ paymentId, amountCents: 10000 })` inserts a `balance_entry` with `kind: "refund_reversal"`, `amountCents: 9700`.

```ts
// apps/api/src/routes/payouts-refund.test.ts — key assertions
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertValues, mockDb, paymentRow, invoiceRow } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const paymentRow = { id: "pay_1", invoiceId: "inv_1", status: "succeeded", amountCents: 10000, refundedCents: 0, currency: "PHP" };
  const invoiceRow = { id: "inv_1", number: "INV-1", kind: "case", lawyerId: "law_1", paidCents: 10000, totalCents: 10000, paidAt: new Date() };
  const mockDb = {
    query: {
      payments: { findFirst: vi.fn().mockResolvedValue(paymentRow) },
      invoices: { findFirst: vi.fn().mockResolvedValue(invoiceRow) },
      balanceEntries: { findFirst: vi.fn().mockResolvedValue({ amountCents: 300 }) },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  };
  return { mockInsertValues, mockDb, paymentRow, invoiceRow };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: { payments: {}, invoices: {}, transactions: {}, balanceEntries: { relatedPaymentId: "related_payment_id", kind: "kind" } },
}));
vi.mock("../lib/env", () => ({ env: () => ({ PAYOUT_CLEARING_DAYS: 3, BETTER_AUTH_URL: "https://app.test" }) }));
vi.mock("@ligala/email", () => ({ dispatchEmail: vi.fn() }));

import { refundPayment } from "./billing";

describe("refundPayment — balance reversal", () => {
  beforeEach(() => mockInsertValues.mockClear());
  it("inserts a refund_reversal for the net credited", async () => {
    await refundPayment({ paymentId: "pay_1", amountCents: 10000 });
    const rev = mockInsertValues.mock.calls.map((c) => c[0]).find((v) => v?.kind === "refund_reversal");
    expect(rev?.amountCents).toBe(9700);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ligala/api test -- payouts-refund`
Expected: PASS. Then `pnpm --filter @ligala/api test -- billing` to confirm no regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/routes/payouts-refund.test.ts
git commit -m "feat(api): reverse lawyer balance on refund (net, pro-rata)"
```

---

## Task 11: Payouts route — balance, ledger, methods, withdraw

**Files:**
- Create: `apps/api/src/routes/payouts.ts`
- Modify: `apps/api/src/app.ts`

This is the lawyer-facing API. All endpoints require role `lawyer`; mutations additionally require KYC-approved. Withdrawal serializes per-lawyer with a Postgres advisory lock to prevent double-spend, recomputes available inside the transaction, writes the `payout` + ledger debits, then calls PayMongo (or marks `dev_simulate`).

- [ ] **Step 1: Create the route file**

Create `apps/api/src/routes/payouts.ts`:

```ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { payoutMethodInput, withdrawalInput } from "@ligala/shared/schemas";
import { requireRole } from "../middleware/session";
import {
  PAYOUT_FEE_CENTS,
  checkWithdrawable,
  computeBalance,
  type LedgerLine,
} from "../lib/payouts";
import { env } from "../lib/env";
import {
  createBatchTransfer,
  PaymongoApiError,
  PaymongoUnreachableError,
} from "../lib/paymongo";

function newId() {
  return crypto.randomUUID();
}

/** Stable advisory-lock key per lawyer (FNV-1a → signed 32-bit int). */
function lawyerLockKey(lawyerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < lawyerId.length; i++) {
    h ^= lawyerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** True iff the lawyer's most-recent KYC submission is approved. */
async function isKycApproved(lawyerId: string): Promise<boolean> {
  const latest = await db().query.kycSubmissions.findFirst({
    where: eq(schema.kycSubmissions.lawyerId, lawyerId),
    orderBy: desc(schema.kycSubmissions.createdAt),
  });
  return latest?.status === "approved";
}

async function loadLedgerLines(lawyerId: string): Promise<LedgerLine[]> {
  const rows = await db()
    .select({
      direction: schema.balanceEntries.direction,
      amountCents: schema.balanceEntries.amountCents,
      clearsAt: schema.balanceEntries.clearsAt,
    })
    .from(schema.balanceEntries)
    .where(eq(schema.balanceEntries.lawyerId, lawyerId));
  return rows.map((r) => ({
    direction: r.direction,
    amountCents: Number(r.amountCents),
    clearsAt: r.clearsAt,
  }));
}

export const payouts = new Hono()
  .use("*", requireRole("lawyer"))

  // --- Balance --------------------------------------------------------------
  .get("/balance", async (c) => {
    const user = c.get("user");
    const lines = await loadLedgerLines(user.id);
    const { availableCents, pendingCents } = computeBalance(lines, new Date());
    return c.json({ availableCents, pendingCents, currency: "PHP" });
  })

  // --- Ledger ---------------------------------------------------------------
  .get("/ledger", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.balanceEntries)
      .where(eq(schema.balanceEntries.lawyerId, user.id))
      .orderBy(desc(schema.balanceEntries.createdAt))
      .limit(200);
    return c.json({ items: rows });
  })

  // --- Payout methods -------------------------------------------------------
  .get("/methods", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.lawyerPayoutMethods)
      .where(eq(schema.lawyerPayoutMethods.lawyerId, user.id))
      .orderBy(desc(schema.lawyerPayoutMethods.createdAt));
    return c.json({ items: rows });
  })

  .post("/methods", zValidator("json", payoutMethodInput), async (c) => {
    const user = c.get("user");
    if (!(await isKycApproved(user.id))) {
      throw new HTTPException(403, { message: "kyc_not_approved" });
    }
    const input = c.req.valid("json");
    const [row] = await db()
      .insert(schema.lawyerPayoutMethods)
      .values({
        id: newId(),
        lawyerId: user.id,
        type: input.type,
        accountNumber: input.accountNumber,
        accountHolderName: input.accountHolderName,
        bankBic: input.bankBic ?? null,
        isDefault: input.isDefault ?? false,
      })
      .returning();
    return c.json({ method: row }, 201);
  })

  .delete("/methods/:id", async (c) => {
    const user = c.get("user");
    const method = await db().query.lawyerPayoutMethods.findFirst({
      where: eq(schema.lawyerPayoutMethods.id, c.req.param("id")),
    });
    if (!method || method.lawyerId !== user.id) {
      throw new HTTPException(404, { message: "method_not_found" });
    }
    await db()
      .delete(schema.lawyerPayoutMethods)
      .where(eq(schema.lawyerPayoutMethods.id, method.id));
    return c.json({ ok: true });
  })

  // --- Withdrawals ----------------------------------------------------------
  .get("/", async (c) => {
    const user = c.get("user");
    const rows = await db()
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.lawyerId, user.id))
      .orderBy(desc(schema.payouts.createdAt));
    return c.json({ items: rows });
  })

  .post("/", zValidator("json", withdrawalInput), async (c) => {
    const user = c.get("user");
    if (!(await isKycApproved(user.id))) {
      throw new HTTPException(403, { message: "kyc_not_approved" });
    }
    const input = c.req.valid("json");
    const conn = db();

    const method = await conn.query.lawyerPayoutMethods.findFirst({
      where: eq(schema.lawyerPayoutMethods.id, input.payoutMethodId),
    });
    if (!method || method.lawyerId !== user.id) {
      throw new HTTPException(404, { message: "method_not_found" });
    }

    // Serialize withdrawals per lawyer + recompute available under the lock so
    // two concurrent requests can't double-spend the same balance.
    const payoutRow = await conn.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${lawyerLockKey(user.id)})`);

      const rows = await tx
        .select({
          direction: schema.balanceEntries.direction,
          amountCents: schema.balanceEntries.amountCents,
          clearsAt: schema.balanceEntries.clearsAt,
        })
        .from(schema.balanceEntries)
        .where(eq(schema.balanceEntries.lawyerId, user.id));
      const lines: LedgerLine[] = rows.map((r) => ({
        direction: r.direction,
        amountCents: Number(r.amountCents),
        clearsAt: r.clearsAt,
      }));
      const { availableCents } = computeBalance(lines, new Date());

      const check = checkWithdrawable({
        requestCents: input.amountCents,
        availableCents,
        minCents: env().PAYOUT_MIN_CENTS,
      });
      if (!check.ok) throw new HTTPException(409, { message: check.error });

      const provider = env().PAYMONGO_WALLET_ACCOUNT_NUMBER ? "paymongo" : "dev_simulate";
      const netCents = input.amountCents - PAYOUT_FEE_CENTS;
      if (netCents <= 0) throw new HTTPException(409, { message: "amount_below_minimum" });

      const id = newId();
      const now = new Date();
      const [created] = await tx
        .insert(schema.payouts)
        .values({
          id,
          lawyerId: user.id,
          payoutMethodId: method.id,
          amountCents: input.amountCents,
          feeCents: PAYOUT_FEE_CENTS,
          netCents,
          currency: "PHP",
          provider,
          status: "pending",
          destinationSnapshot: {
            type: method.type,
            accountNumber: method.accountNumber,
            accountHolderName: method.accountHolderName,
            bankBic: method.bankBic,
          },
        })
        .returning();

      // Debit the ledger immediately (payout + fee). clears_at = now.
      await tx.insert(schema.balanceEntries).values([
        {
          id: newId(),
          lawyerId: user.id,
          kind: "payout",
          direction: "debit",
          amountCents: netCents,
          currency: "PHP",
          clearsAt: now,
          relatedPayoutId: id,
          note: `Withdrawal ${id}`,
        },
        {
          id: newId(),
          lawyerId: user.id,
          kind: "payout_fee",
          direction: "debit",
          amountCents: PAYOUT_FEE_CENTS,
          currency: "PHP",
          clearsAt: now,
          relatedPayoutId: id,
          note: `Payout fee ${id}`,
        },
      ]);

      return created!;
    });

    // Outside the txn: call PayMongo (dev_simulate stays pending until simulated).
    if (payoutRow.provider === "dev_simulate") {
      return c.json({ payout: payoutRow }, 201);
    }

    const e = env();
    const rail: "instapay" | "pesonet" = method.type === "bank" ? "pesonet" : "instapay";
    try {
      const { transferId } = await createBatchTransfer({
        secretKey: e.PAYMONGO_SECRET_KEY ?? "",
        amountCents: payoutRow.netCents,
        currency: "PHP",
        provider: rail,
        sourceAccount: {
          number: e.PAYMONGO_WALLET_ACCOUNT_NUMBER ?? "",
          name: e.PAYMONGO_WALLET_ACCOUNT_NAME,
          bic: e.PAYMONGO_WALLET_BIC ?? undefined,
        },
        destination: {
          number: method.accountNumber,
          name: method.accountHolderName,
          bic: method.bankBic ?? undefined,
        },
        referenceNumber: payoutRow.id,
        callbackUrl: `${e.BETTER_AUTH_URL}/webhooks/paymongo-transfer`,
        idempotencyKey: payoutRow.id,
      });
      await conn
        .update(schema.payouts)
        .set({ providerTransferId: transferId, status: "processing", updatedAt: new Date() })
        .where(eq(schema.payouts.id, payoutRow.id));
      return c.json({ payout: { ...payoutRow, providerTransferId: transferId, status: "processing" } }, 201);
    } catch (err) {
      // Disbursement call failed before acceptance: mark failed + re-credit.
      await conn
        .update(schema.payouts)
        .set({ status: "failed", failureReason: "disbursement_request_failed", updatedAt: new Date() })
        .where(eq(schema.payouts.id, payoutRow.id));
      await conn.insert(schema.balanceEntries).values([
        {
          id: newId(), lawyerId: user.id, kind: "adjustment", direction: "credit",
          amountCents: payoutRow.netCents, currency: "PHP", clearsAt: new Date(),
          relatedPayoutId: payoutRow.id, note: `Re-credit failed payout ${payoutRow.id}`,
        },
        {
          id: newId(), lawyerId: user.id, kind: "adjustment", direction: "credit",
          amountCents: PAYOUT_FEE_CENTS, currency: "PHP", clearsAt: new Date(),
          relatedPayoutId: payoutRow.id, note: `Re-credit payout fee ${payoutRow.id}`,
        },
      ]);
      if (err instanceof PaymongoApiError) {
        console.error("paymongo_transfer_failed", err.status, err.bodyText.slice(0, 200));
        throw new HTTPException(502, { message: "paymongo_request_failed" });
      }
      if (err instanceof PaymongoUnreachableError) {
        console.error("paymongo_transfer_unreachable", err.cause);
        throw new HTTPException(502, { message: "paymongo_unreachable" });
      }
      throw err;
    }
  });
```

- [ ] **Step 2: Mount the route**

In `apps/api/src/app.ts`, add the import near the other route imports:

```ts
import { payouts } from "./routes/payouts";
```

and the mount (after the `/lawyer/subscription` line):

```ts
  app.route("/lawyer/payouts", payouts);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 4: Add a focused withdrawal test**

Create `apps/api/src/routes/payouts.test.ts` using the `vi.hoisted`/`vi.mock` harness. Stub `requireRole` to inject a lawyer, mock `@ligala/db` so the advisory lock + ledger select yield an available balance, and assert: (a) a withdrawal at/above the minimum and within balance returns 201 with a `payout`; (b) below the minimum returns 409 `amount_below_minimum`; (c) above the available returns 409 `insufficient_balance`; (d) missing/foreign method returns 404 `method_not_found`. Mock `createBatchTransfer` from `../lib/paymongo` and force `provider === "dev_simulate"` (leave `PAYMONGO_WALLET_ACCOUNT_NUMBER` unset in the env mock) so no real HTTP is attempted.

```ts
// apps/api/src/routes/payouts.test.ts — skeleton
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const { txState, mockDb, mockEnv, LAWYER } = vi.hoisted(() => {
  const LAWYER = "law_1";
  // ledger lines returned by both the top-level select and the in-txn select
  const txState = { lines: [] as Array<{ direction: string; amountCents: number; clearsAt: Date }> };
  const selectChain = () => ({
    from: () => ({
      where: () => ({ orderBy: () => ({ limit: async () => [] }) }),
      // support `.where()` returning the ledger rows directly (no orderBy)
    }),
  });
  const mockEnv = { PAYOUT_MIN_CENTS: 50000, PAYMONGO_WALLET_ACCOUNT_NUMBER: undefined, BETTER_AUTH_URL: "https://app.test", PAYMONGO_WALLET_ACCOUNT_NAME: "Ligala" };
  const mockDb = { /* fill: query.lawyerPayoutMethods.findFirst, query.kycSubmissions.findFirst→approved,
                     select() for ledger, transaction(cb) that runs cb with a tx exposing execute/select/insert/returning */ };
  return { txState, mockDb, mockEnv, LAWYER };
});
```

> The route's DB access is non-trivial to mock (advisory lock + transaction + two selects). Implement the mock to satisfy exactly the calls the handler makes (`tx.execute`, `tx.select(...).from(...).where(...)` → ledger rows, `tx.insert(...).values(...).returning()` → the payout row). Keep the pure-math coverage (Tasks 4–5) as the primary guarantee; these route tests assert wiring + status codes. If the transaction mock proves brittle, assert the happy path + the two 409s and cover `method_not_found` with a unit test, and verify the rest via the dev-simulate smoke in Task 13.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ligala/api test -- routes/payouts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/payouts.ts apps/api/src/routes/payouts.test.ts apps/api/src/app.ts
git commit -m "feat(api): payouts route (balance, ledger, methods, withdraw)"
```

---

## Task 12: Transfer reconciliation webhook

**Files:**
- Create: `apps/api/src/lib/transfer-webhook.ts` (pure mapper + applier)
- Modify: `apps/api/src/routes/webhooks.ts`

Splitting the apply logic into its own module keeps it unit-testable and lets `dev_simulate` (Task 13) reuse it.

- [ ] **Step 1: Write failing tests for the status mapper**

Create `apps/api/src/lib/transfer-webhook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapTransferStatus } from "./transfer-webhook";

describe("mapTransferStatus", () => {
  it("maps provider statuses to payout statuses", () => {
    expect(mapTransferStatus("succeeded")).toBe("succeeded");
    expect(mapTransferStatus("failed")).toBe("failed");
    expect(mapTransferStatus("returned")).toBe("returned");
  });
  it("treats unknown as null (ignore)", () => {
    expect(mapTransferStatus("queued")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ligala/api test -- lib/transfer-webhook`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `apps/api/src/lib/transfer-webhook.ts`:

```ts
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";

export type PayoutWebhookStatus = "succeeded" | "failed" | "returned";

export function mapTransferStatus(raw: string): PayoutWebhookStatus | null {
  if (raw === "succeeded") return "succeeded";
  if (raw === "failed") return "failed";
  if (raw === "returned") return "returned";
  return null;
}

/**
 * Idempotent transfer reconciliation. Keyed on (provider, providerTransferId);
 * a replayed event for an already-terminal payout no-ops. On failed/returned,
 * re-credit the lawyer's balance so funds are never lost.
 */
export async function applyTransferWebhook(input: {
  provider: "paymongo" | "dev_simulate";
  providerTransferId: string;
  status: PayoutWebhookStatus;
  failureReason?: string;
}) {
  const conn = db();
  const payout = await conn.query.payouts.findFirst({
    where:
      input.provider === "dev_simulate"
        ? eq(schema.payouts.id, input.providerTransferId)
        : eq(schema.payouts.providerTransferId, input.providerTransferId),
  });
  if (!payout) throw new HTTPException(404, { message: "payout_not_found" });

  if (payout.status === "succeeded" || payout.status === "failed" || payout.status === "returned") {
    return { idempotent: true, payoutId: payout.id, status: payout.status };
  }

  const now = new Date();
  await conn
    .update(schema.payouts)
    .set({
      status: input.status,
      failureReason: input.failureReason ?? null,
      completedAt: input.status === "succeeded" ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.payouts.id, payout.id));

  if (input.status === "failed" || input.status === "returned") {
    await conn.insert(schema.balanceEntries).values([
      {
        id: crypto.randomUUID(), lawyerId: payout.lawyerId, kind: "adjustment", direction: "credit",
        amountCents: payout.netCents, currency: payout.currency, clearsAt: now,
        relatedPayoutId: payout.id, note: `Re-credit ${input.status} payout ${payout.id}`,
      },
      {
        id: crypto.randomUUID(), lawyerId: payout.lawyerId, kind: "adjustment", direction: "credit",
        amountCents: payout.feeCents, currency: payout.currency, clearsAt: now,
        relatedPayoutId: payout.id, note: `Re-credit payout fee ${payout.id}`,
      },
    ]);
  }

  return { idempotent: false, payoutId: payout.id, status: input.status };
}
```

- [ ] **Step 4: Run mapper test to verify pass**

Run: `pnpm --filter @ligala/api test -- lib/transfer-webhook`
Expected: PASS.

- [ ] **Step 5: Wire the webhook route**

In `apps/api/src/routes/webhooks.ts`, add imports:

```ts
import { applyTransferWebhook, mapTransferStatus } from "../lib/transfer-webhook";
```

and add a handler to the `webhooks` chain (after `/paymongo`):

```ts
  .post("/paymongo-transfer", async (c) => {
    // ⚠️ Sandbox gate: confirm PayMongo's transfer webhook signature scheme +
    // event/status shape. We reuse the same HMAC verifier as /paymongo.
    const secret = env().PAYMONGO_TRANSFER_WEBHOOK_SECRET ?? env().PAYMONGO_WEBHOOK_SECRET;
    if (!secret) return c.json({ error: "transfer_webhook_not_configured" }, 501);
    const raw = await c.req.raw.text();
    const header = c.req.header("Paymongo-Signature");
    let event: PaymongoEvent;
    try {
      event = verifyWebhookSignature(raw, header, secret);
    } catch (err) {
      console.warn("paymongo_transfer_signature_invalid", err);
      return c.json({ error: "invalid_signature" }, 401);
    }
    const resource = event.data.attributes.data;
    const providerTransferId = resource.id;
    const rawStatus =
      typeof resource.attributes.status === "string" ? resource.attributes.status : "";
    const status = mapTransferStatus(rawStatus);
    if (!status) return c.json({ ignored: true, status: rawStatus });

    try {
      const result = await applyTransferWebhook({
        provider: "paymongo",
        providerTransferId,
        status,
        failureReason:
          typeof resource.attributes.last_payment_error?.message === "string"
            ? resource.attributes.last_payment_error.message
            : undefined,
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof HTTPException && err.status === 404) {
        console.error("paymongo_transfer_payout_not_found", { providerTransferId });
        return c.json({ ignored: true, reason: "payout_not_found" });
      }
      throw err;
    }
  })
```

> `PaymongoEvent`, `verifyWebhookSignature`, `env`, and `HTTPException` are already imported in `webhooks.ts`. The `PaymongoEvent` inner `attributes` already allows arbitrary keys (`[key: string]: unknown`), so `status` reads fine; add `status?: string` to the type in `paymongo.ts` if you prefer it explicit.

- [ ] **Step 6: Typecheck + test**

Run: `pnpm --filter @ligala/api typecheck && pnpm --filter @ligala/api test -- transfer`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/transfer-webhook.ts apps/api/src/lib/transfer-webhook.test.ts apps/api/src/routes/webhooks.ts
git commit -m "feat(api): transfer reconciliation webhook (idempotent, re-credit on fail)"
```

---

## Task 13: Dev-simulate transfer path

**Files:**
- Modify: `apps/api/src/routes/payouts.ts` (add `payoutsDev` router export)
- Modify: `apps/api/src/app.ts`

Mirrors `billingDev` — a session-less endpoint the dev/local flow hits to flip a `dev_simulate` payout to succeeded/failed without live disbursement keys.

- [ ] **Step 1: Export a dev router**

Append to `apps/api/src/routes/payouts.ts`:

```ts
import { applyTransferWebhook } from "../lib/transfer-webhook";

/**
 * Dev-only payout simulator. Flips a `dev_simulate` payout to succeeded/failed.
 * Session-less (mounted outside `payouts`' requireRole), mirroring billingDev.
 */
export const payoutsDev = new Hono().post("/simulate-transfer", async (c) => {
  const url = new URL(c.req.url);
  const payoutId = url.searchParams.get("payoutId");
  const status = url.searchParams.get("status") === "failed" ? "failed" : "succeeded";
  if (!payoutId) throw new HTTPException(400, { message: "missing_params" });
  const result = await applyTransferWebhook({
    provider: "dev_simulate",
    providerTransferId: payoutId, // for dev_simulate we look up by payout.id
    status,
  });
  return c.json(result);
});
```

- [ ] **Step 2: Mount it before the gated route**

In `apps/api/src/app.ts`, update the import and add the mount **before** `/lawyer/payouts`:

```ts
import { payouts, payoutsDev } from "./routes/payouts";
```

```ts
  // `payoutsDev` before the auth-gated `payouts` so the more specific path
  // matches first and skips requireRole (mirrors the /billing/dev precedent).
  app.route("/lawyer/payouts/dev", payoutsDev);
  app.route("/lawyer/payouts", payouts);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 4: Manual end-to-end smoke (local)**

With `docker compose up -d` + `pnpm dev` running, and a KYC-approved lawyer with a credited, cleared balance (set `PAYOUT_CLEARING_DAYS=0` locally to skip waiting):
1. `POST /lawyer/payouts/methods` → add a gcash method.
2. `POST /lawyer/payouts` → create a withdrawal (provider resolves to `dev_simulate` since `PAYMONGO_WALLET_ACCOUNT_NUMBER` is unset). Note the returned `payout.id`.
3. `POST /lawyer/payouts/dev/simulate-transfer?payoutId=<id>&status=succeeded`.
4. `GET /lawyer/payouts/balance` → available reflects the debit; `GET /lawyer/payouts` → payout is `succeeded`.
5. Re-POST step 3 → response `{ idempotent: true }`, balance unchanged.

Expected: balance math and idempotency behave as above.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/payouts.ts apps/api/src/app.ts
git commit -m "feat(api): dev_simulate transfer path for local payout testing"
```

---

## Task 14: Full-suite gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the graph**

Run: `pnpm typecheck`
Expected: PASS across all packages.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (no new errors; recall `no-console` allows `warn`/`error`/`info` — the `console.error` calls are fine).

- [ ] **Step 3: Test**

Run: `pnpm test`
Expected: PASS, including the new `@ligala/shared` and `@ligala/api` payout tests.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: PASS (esbuild bundles the api with the new route + lib).

- [ ] **Step 5: Update the phase tracker**

Append a short entry to `PROCESS.md` noting the lawyer-payouts backend landed (balance ledger, withdrawals, PayMongo disbursement, transfer webhook, dev-simulate) and that the web UI + admin views + clearing scanner are the follow-up (Plan 2). Do not restructure existing content.

- [ ] **Step 6: Commit**

```bash
git add PROCESS.md
git commit -m "docs: mark lawyer-payouts backend complete in PROCESS.md"
```

---

## Self-review notes (coverage against spec)

- §4 money model → Tasks 8 (earning + processing_fee credit), 9 (real fee), 5/10 (refund reversal of net).
- §5 data model → Tasks 1–2 (`balance_entry`, `payout`, `lawyer_payout_method`); `lawyer_balance` deliberately deferred (balance computed from ledger per §11).
- §6 methods/limits/eligibility → Task 11 (gcash/maya/bank methods, KYC gate, `PAYOUT_MIN_CENTS`); e-wallet limit UX is a Plan-2 (web) concern.
- §7 flows → Tasks 8 (credit), 11 (withdraw), 12 (reconcile).
- §8 refunds/holds/negative → Tasks 4 (clearing via `clears_at`), 10 (refund reversal, negative allowed), 11 (withdrawals blocked when available insufficient).
- §9 errors → Task 11 (re-credit on disbursement failure, 502s), 12 (re-credit on failed/returned, 404 acknowledge).
- §12 testing → pure-math tests (Tasks 4–5), provider-call tests (Task 6), credit/refund tests (Tasks 8/10), dev-simulate smoke (Task 13).
- Sandbox unknowns from §14 are flagged at the top and inline in Tasks 6, 9, 12.
```

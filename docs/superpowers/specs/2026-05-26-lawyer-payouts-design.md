# Lawyer Payouts (Collect → Balance → Withdraw) — Design Spec

- **Date:** 2026-05-26
- **Status:** Approved (brainstorming) — ready for implementation planning
- **Author:** Session (Claude + techteam)
- **Related:** `docs/superpowers/specs/2026-05-21-paymongo-lawyer-subscription-design.md`; `apps/api/src/routes/billing.ts` (`applyPaymentWebhook`, `refundPayment`); `apps/api/src/lib/paymongo.ts`

## 1. Context & goal

Today the billing system **collects** client payments for case invoices via PayMongo hosted checkout and records them (`payment` + `transaction` ledger rows, `invoice.paidCents`). But the collected funds settle into **Ligala's single platform PayMongo account** — there is no mechanism to get money to the lawyer. There are no payout/disbursement, bank-account, or balance concepts anywhere in the schema. The money layer is accounting-only (mirrors the "refunds are accounting-only" stance).

Most lawyers do **not** have a PayMongo merchant account, but they do have personal **GCash** and **Maya** wallets. So the requirement is: after a client pays, the lawyer must be able to receive that money in their GCash/Maya (or bank) account.

**Goal:** build a **collect → per-lawyer balance → withdraw-to-wallet** payout pipeline. The platform collects via PayMongo (unchanged), accrues a withdrawable balance per lawyer, and disburses to the lawyer's GCash/Maya/bank via **PayMongo's Money Movement / Disbursements API**, with full pass-through of the legal fee (no commission skimmed).

## 2. Key decisions & rationale

These were settled during brainstorming and drive the rest of the spec:

1. **Payout timing: balance + withdrawal.** Payments accrue to a per-lawyer balance; the lawyer requests a withdrawal. Lets refunds net against the balance before cash-out and batches payout fees. (Alternatives considered: auto-disburse per payment — refund-fragile; scheduled batch — less lawyer control.)
2. **Disbursement provider: PayMongo Money Movement / Disbursements.** Single vendor — disburse from the same PayMongo Wallet that already holds collected funds (no cross-vendor treasury shuffle), and funds stay custodied by PayMongo (a licensed EMI) rather than in Ligala's name. Verified GA: `POST /v2/batch_transfers` to GCash/Maya/banks (InstaPay/PESONet), async webhooks, idempotency, ₱10/transfer fee. (Alternatives: Xendit Payouts — separate pre-funded balance, weaker custody posture; direct GCash/Maya APIs — partner-gated, not self-serve.)
3. **Revenue model: pass-through, NO commission on the legal fee.** Platform revenue stays the **lawyer subscription** (optionally fixed lawyer-billed listing/feature fees later). This reverses an earlier inclination to skim a per-payment commission — see §3 (legal-ethics constraint). The lawyer's balance accrues the full fee minus only PayMongo's real processing cost.
4. **Processing fees: lawyer absorbs both.** PayMongo's collection fee (read from the payment, not estimated) is netted from the credit; the ₱10 disbursement fee is netted from each withdrawal. These are genuine third-party processing costs, transparently disclosed — not platform revenue.
5. **Payout destinations: GCash, Maya, and bank account.** Bank is included deliberately — see §6 (wallet receiving limits).
6. **Eligibility: KYC-approved lawyers only** can add a payout method or withdraw (reuses the existing KYC gate).

## 3. Compliance constraints (MUST confirm with PH counsel / IBP before launch)

This feature handles lawyers' legal fees, so profession-specific rules apply. These findings are **research, not legal advice** — flagged for counsel confirmation, but they shaped the design above.

- **No fee-splitting with non-lawyers (CPRA Canon III, §43).** A lawyer "shall not share, split, or divide … **directly or indirectly**, a fee for legal services with persons or organizations not licensed … to practice law." A platform commission taken **out of the legal fee — flat or percentage — is the paradigm violation**; relabeling it ("commission"/"service fee") does not cure it (cf. US *Avvo* opinions, where even a *flat* per-engagement marketing fee was struck down across 8+ states). → **Decision: pass-through, revenue billed to the lawyer (subscription), never skimmed from client funds.**
- **Third-party compensation (CPRA §44).** A lawyer shall not receive compensation from anyone other than the client absent **written informed consent**. Relevant because the platform sits in the funds flow. → Disclose the funds flow + processing-fee absorption; capture client consent at checkout where required.
- **Client-fund handling (CPRA §§49–50).** Lawyers must keep client funds **separate**, account for them, and not commingle. A platform holding the lawyer's money implicates the lawyer's own fiduciary duties. → **Prefer prompt, full remittance**; keep held funds in PayMongo's wallet (licensed EMI), not Ligala's corporate account.
- **BSP / custody.** Holding per-lawyer balances **in Ligala's own name** risks **EMI licensing** (~₱200M capital). Standard marketplace posture: "funds held by the licensed PSP, not the platform." Using the PayMongo Wallet as the holding location supports this. → Confirm the custody boundary with counsel; ensure the held balance legally sits with PayMongo, with our `lawyer_balance` as a sub-accounting view.

## 4. Money model

Per successful **case-invoice** client payment of gross `G` cents (subscription invoices are unaffected — they are platform revenue, not lawyer earnings):

```
G  (gross client payment)
 − Fc   PayMongo collection fee   (read the ACTUAL fee from the PayMongo
                                    payment object; do NOT estimate)
 ───────
 = N    net credited to the lawyer's balance
```

Withdrawal of available amount `W`:

```
W
 − 10  PayMongo ₱10 disbursement fee   (lawyer absorbs)
 ──────
 = D   amount landing in the lawyer's GCash / Maya / bank
```

**Guards:**
- **Minimum payable invoice** so `N` is always meaningfully positive (the lawyer absorbs `Fc`). Layers on top of PayMongo's existing ₱20 checkout minimum.
- **Real collection fee.** Credit `N` from PayMongo's reported `fee`/`net_amount`, never an estimate. **Verify in sandbox** that the fee is present on the `checkout_session.payment.paid` payload we key off today; if not, fetch the payment object by id before crediting.

**Ledger entries per successful payment:** `earning` (credit `+G`) and `processing_fee` (debit `−Fc`). Net = lawyer's balance delta.

## 5. Data model

New self-contained **`payouts`** aggregate, following the one-aggregate-per-three-files convention (`packages/db/src/schema/payouts.ts` + `packages/shared/src/schemas/payouts.ts` + `apps/api/src/routes/payouts.ts`). The invoice `transactions` table is left as-is (it stays the *client-facing* gross record); the lawyer-balance domain owns its own ledger to keep boundaries clean.

**`lawyer_balance`** — maintained running total (fast-read column; ledger below is source of truth, mirroring `invoice.paidCents`):

| column | type | notes |
|---|---|---|
| `lawyer_id` | text PK FK→user | 1:1 |
| `available_cents` | integer default 0 | withdrawable |
| `pending_cents` | integer default 0 | within clearing window (§8) |
| `currency` | text default `PHP` | |
| `created_at`, `updated_at` | timestamptz | |

**`balance_entry`** — append-only ledger:

| column | type | notes |
|---|---|---|
| `id` | text PK | |
| `lawyer_id` | text FK→user | |
| `kind` | enum | `earning` \| `processing_fee` \| `payout` \| `payout_fee` \| `refund_reversal` \| `adjustment` |
| `direction` | enum | `credit` \| `debit` |
| `amount_cents` | bigint | |
| `currency` | text default `PHP` | |
| `related_payment_id` | text null FK→payment | for `earning`/`processing_fee`/`refund_reversal` |
| `related_payout_id` | text null FK→payout | for `payout`/`payout_fee` |
| `note` | text null | |
| `created_at` | timestamptz | |

**`payout`** — one row per withdrawal:

| column | type | notes |
|---|---|---|
| `id` | text PK | |
| `lawyer_id` | text FK→user | |
| `payout_method_id` | text FK→lawyer_payout_method | destination |
| `amount_cents` | integer | requested (gross debited from balance) |
| `fee_cents` | integer default 1000 | ₱10 |
| `net_cents` | integer | actually disbursed (`amount − fee`) |
| `currency` | text default `PHP` | |
| `provider` | enum | `paymongo` \| `dev_simulate` |
| `provider_transfer_id` | text null | **UNIQUE (provider, provider_transfer_id)** — webhook idempotency |
| `status` | enum | `pending` \| `processing` \| `succeeded` \| `failed` \| `returned` |
| `failure_reason` | text null | |
| `destination_snapshot` | jsonb | type/account/holder at time of payout (immutable record) |
| `requested_at`, `completed_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

**`lawyer_payout_method`** — where GCash/Maya/bank details live (`lawyer_profile` has none today):

| column | type | notes |
|---|---|---|
| `id` | text PK | |
| `lawyer_id` | text FK→user | |
| `type` | enum | `gcash` \| `maya` \| `bank` |
| `account_number` | text | mobile # (`09XXXXXXXXX`) for e-wallets; account # for bank |
| `account_holder_name` | text | |
| `bank_bic` | text null | banks only (PayMongo institution/BIC code) |
| `is_default` | boolean default false | |
| `verified` | boolean default false | |
| `created_at`, `updated_at` | timestamptz | |

Migration via `pnpm db:generate` → `packages/db/drizzle/NNNN_*.sql` → `pnpm db:migrate`.

## 6. Payout methods, limits, eligibility

- **Destinations: GCash, Maya, and bank account.** Bank is included because a *fully-verified personal* GCash/Maya caps at roughly **₱100k/month incoming**; a busy lawyer will exceed it and the disbursement will bounce. The same PayMongo API reaches banks via InstaPay (≤₱50k/txn, real-time) and PESONet (larger, same/next-day batch).
- **Eligibility:** only **KYC-approved** lawyers may add a payout method or request a withdrawal.
- **Minimum withdrawal:** ₱500 default (so the ₱10 fee isn't a painful %), admin-configurable.
- **Limit UX:** surface the e-wallet monthly receiving cap and nudge lawyers with large balances toward a bank destination. (A payout can succeed on PayMongo's side but be `returned` if the recipient wallet's cap is exceeded — handle as a `returned` re-credit, §8.)
- **ToS note:** receiving business income via a *personal* wallet runs against GCash/Maya consumer terms — counsel/business call; bank option mitigates.

## 7. Flows

1. **Credit on payment.** Extend `applyPaymentWebhook` (the existing idempotent helper, dedup on `(provider, providerPaymentId)`): when a **case** invoice payment succeeds, additionally write `earning` + `processing_fee` `balance_entry` rows and bump `lawyer_balance.pending_cents`, in the **same** operation as the existing payment/transaction writes. The existing idempotency guard means replays never double-credit. (Subscription invoices skip this — unchanged.)
2. **Clearing.** Funds move `pending_cents → available_cents` after the clearing window (§8). Mechanism: a `clears_at` timestamp on the earning + a scan (EventBridge-scheduled worker, or computed-on-read for v1 — see §11).
3. **Add/manage payout method.** KYC-gated CRUD on `lawyer_payout_method`. Validate shape per `type` (e-wallet mobile format vs bank account + BIC).
4. **Request withdrawal.** Lawyer requests `W` (≥ minimum, ≤ `available_cents`) to a chosen method. Create `payout` (`pending`), debit `available_cents` by `W` and write `payout` (`−(W−fee)`) + `payout_fee` (`−fee`) entries, then call PayMongo `POST /v2/batch_transfers` from the platform wallet. Store `provider_transfer_id`, set `processing`. Use an **`Idempotency-Key`** so retries don't double-send (verify exact header in sandbox).
5. **Reconcile.** New webhook handler (e.g. `/webhooks/paymongo-transfer`) keyed on `provider_transfer_id`: `succeeded` → `payout.succeeded` + `completed_at`; `failed`/`returned` → set status + `failure_reason` and **re-credit** `available_cents` (write a reversing `balance_entry`) so funds are never lost. Idempotent on the unique `(provider, provider_transfer_id)` index (mirrors the payment-webhook pattern).

## 8. Refunds, holds, negative balance

- **Clearing window.** Credited funds sit in `pending_cents` for a configurable window (**default 3 days**, tunable to 0) before becoming `available_cents`. Covers the refund window so we rarely chase money already withdrawn.
- **Refund after credit.** Extend `refundPayment` to write a `refund_reversal` debit against the lawyer's balance equal to the **net previously credited** for the refunded portion — i.e. reverse `earning − processing_fee` pro-rata to `refundedGross / gross`, **not** the gross (the lawyer was only credited `N`, and PayMongo typically does not return its collection fee on a refund). Debit `pending_cents` first, then `available_cents`. (Who funds the gross refund to the client is the existing accounting-only concern, unchanged here.)
- **Negative balance.** If a refund exceeds the current balance (funds already withdrawn), `available_cents` goes **negative**; withdrawals are blocked until future earnings bring it back to ≥ 0. No clawback from the lawyer's wallet in v1.

## 9. Error handling

- **PayMongo unreachable / API error on withdrawal:** reuse `PaymongoApiError` / `PaymongoUnreachableError`. Payout stays `pending` (not yet sent) or is marked `failed` with balance **re-credited** — never a silent loss. Surface a 502 to the caller as elsewhere.
- **Transfer webhook for unknown `provider_transfer_id`:** 200-acknowledge + loud log (avoid provider retry storms), mirroring the `paymongo_webhook_invoice_not_found` handling.
- **Returned funds:** PayMongo credits returned transfers back to the wallet; we mirror by re-crediting the lawyer balance and marking the `payout` `returned`.
- **Concurrent withdrawal requests:** guard against double-spend of `available_cents` (row lock / conditional update `WHERE available_cents >= W`).

## 10. API surface (Hono, `apps/api/src/routes/payouts.ts`, behind `requireRole("lawyer")` + KYC gate)

- `GET /payouts/balance` — `{ availableCents, pendingCents, currency }`.
- `GET /payouts/ledger` — paginated `balance_entry` list.
- `GET /payouts/methods` / `POST /payouts/methods` / `PATCH|DELETE /payouts/methods/:id`.
- `GET /payouts` — withdrawal history. `POST /payouts` — request withdrawal.
- `POST /webhooks/paymongo-transfer` — reconciliation (outside session middleware; signature-verified like `/webhooks/paymongo`).
- Admin read views (under existing admin routes) for the payout queue + per-lawyer balances; admin `adjustment` entry requires a `reason` (per the admin-audit convention).

Web: lawyer "Payouts / Earnings" portal page (balance, ledger, methods, withdraw) + payment-method form. All mutations go through Server Actions → shared Zod → api (validate both sides).

## 11. Out of scope / deferred

- **Automated scheduled clearing worker.** v1 may compute available-vs-pending on read (using `clears_at`); the EventBridge scanner that physically moves `pending → available` and an automated payout retry are a fast-follow.
- **Provider-side refund execution** (still accounting-only, per the existing stance).
- **Real-time wallet-limit pre-check** against GCash/Maya before disbursing (we react to `returned` instead).
- **Clawback** of over-refunded balances from a lawyer's wallet.
- **Multi-currency** (PHP only).
- **Bulk/batch payout scheduling** beyond single withdrawals (the API supports batches; v1 sends one transfer per withdrawal).

## 12. Testing

- **Unit (balance math):** `earning`/`processing_fee` credit math; minimum-invoice guard; withdrawal debit + ₱10 fee; clearing `pending → available`; refund `refund_reversal` including the negative-balance path.
- **Idempotency:** credit path (replayed `applyPaymentWebhook` doesn't double-credit); transfer-webhook replays (same `provider_transfer_id` no-op); concurrent-withdrawal double-spend guard.
- **Provider mapping:** `batch_transfers` request shape per destination type; webhook status → payout/balance transitions (`succeeded`/`failed`/`returned`).
- **`dev_simulate` transfer path** so the full flow runs locally without live PayMongo payout keys (mirrors the existing `/billing/dev/simulate-payment` stub).
- Mirrors existing patterns in `apps/api/src/routes/billing.email.test.ts` / `paymongo.test.ts`.

## 13. Implementation sequencing (feeds writing-plans)

1. `payouts` schema (4 tables + enums) + migration.
2. `@ligala/shared` payout schemas (method input, withdrawal input, error codes).
3. Balance-credit integration into `applyPaymentWebhook` + `refundPayment` (`refund_reversal`).
4. `apps/api` `payouts` route (balance, ledger, methods, withdraw) + PayMongo `createBatchTransfer` in `lib/paymongo.ts`.
5. Transfer-reconciliation webhook + idempotency.
6. `dev_simulate` transfer path + unit tests.
7. Web: lawyer Payouts portal page + method form + Server Actions.
8. Admin read views + `adjustment` (audited).
9. Infra/env: PayMongo disbursement keys + webhook secret in `lib/env.ts`; (deferred) clearing scanner Lambda + schedule.

## 14. Open questions / to verify before/during build

- **PayMongo sandbox:** exact `Idempotency-Key` header on `/v2/batch_transfers`; whether GCash routes via InstaPay (instant) or PESONet (batch); transfer webhook event names + signature scheme; presence of `fee`/`net_amount` on the `checkout_session.payment.paid` payload.
- **Counsel sign-off** on §3 (fee-splitting / custody posture) before launch.
- **Clearing window default** (3 days) — confirm against the realistic refund/chargeback window.
- **PayMongo Disbursements KYB** enablement on the Ligala account (gated behind business verification).

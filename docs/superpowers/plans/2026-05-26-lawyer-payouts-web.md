# Lawyer Payouts (Web UI + Admin) Implementation Plan — Plan 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lawyer-facing "Payouts" portal (balance, payout methods, withdraw, history) and an admin payout-queue view on top of the Plan 1 backend.

**Architecture:** Next 15 App Router. A new lawyer portal page (`(lawyer)/lawyer/payouts`) is a Server Component that fetches balance/methods/history via the `api()` cookie-forwarding helper and renders them with the existing shadcn `Card`/`Table`/`Button` primitives and the repo's local `Peso`/`shortDate`/`safe` helpers. Mutations (add/delete method, request withdrawal) go through Server Actions in `apps/web/lib/actions/payouts.ts`, which parse with the shared Zod schemas, call `api()`, and `revalidatePath`. A small `requireRole("admin")` sub-router (`adminPayouts`) is added to the API so the admin list page has a data source. Sidebar links are added via `portal-nav-config.ts`.

**Tech Stack:** Next.js 15 (RSC + Server Actions), React 19, shadcn/ui, Hono (one small admin route), Zod.

**Depends on:** Plan 1 (`docs/superpowers/plans/2026-05-26-lawyer-payouts.md`) — its API contract:
- `GET /lawyer/payouts/balance` → `{ availableCents, pendingCents, currency }`
- `GET /lawyer/payouts/ledger` → `{ items: BalanceEntry[] }`
- `GET /lawyer/payouts/methods` → `{ items: PayoutMethod[] }` · `POST /lawyer/payouts/methods` · `DELETE /lawyer/payouts/methods/:id`
- `GET /lawyer/payouts` → `{ items: Payout[] }` · `POST /lawyer/payouts` (withdraw)
- Shared schemas `payoutMethodInput`, `withdrawalInput` from `@ligala/shared/schemas`.

**Spec:** `docs/superpowers/specs/2026-05-26-lawyer-payouts-design.md` (§6 methods/limits/eligibility, §10 API/web surface).

**Testing note (read first):** This repo has **no React component unit tests** — UI is guarded by `pnpm typecheck`, `pnpm build`, and Playwright e2e (`pnpm test:e2e`, serial). So UI tasks below use *create → typecheck → manual/e2e smoke → commit* rather than red-green unit TDD. The one non-UI task (admin API route, Task 7) keeps to vitest TDD.

**Out of scope (later):** admin `adjustment` mutation (needs a new audited backend endpoint), admin payout retry, e-wallet monthly-limit live pre-check, denormalized balance table, clearing scanner.

---

## Task 1: Server Actions for payouts

**Files:**
- Create: `apps/web/lib/actions/payouts.ts`

- [ ] **Step 1: Write the actions file**

```ts
// apps/web/lib/actions/payouts.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  payoutMethodInput,
  withdrawalInput,
  type PayoutMethodInput,
  type WithdrawalInput,
} from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function addPayoutMethod(input: PayoutMethodInput) {
  const parsed = payoutMethodInput.parse(input);
  await api("/lawyer/payouts/methods", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/payouts");
}

export async function deletePayoutMethod(id: string) {
  await api(`/lawyer/payouts/methods/${id}`, { method: "DELETE" });
  revalidatePath("/lawyer/payouts");
}

export async function requestWithdrawal(input: WithdrawalInput) {
  const parsed = withdrawalInput.parse(input);
  const res = await api<{ payout: { id: string; status: string } }>(
    "/lawyer/payouts",
    { method: "POST", body: JSON.stringify(parsed) },
  );
  revalidatePath("/lawyer/payouts");
  return res;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/actions/payouts.ts
git commit -m "feat(web): payout server actions (method CRUD, withdraw)"
```

---

## Task 2: Payout method form (client component)

**Files:**
- Create: `apps/web/app/(lawyer)/lawyer/payouts/_components/method-form.tsx`

Mirrors `discount-codes/form.tsx`: `useState` + `useTransition`, native `<select>` styled to match shadcn, inline error/success. The `bankBic` field shows only for `type === "bank"`; the account-number label/placeholder switches between mobile number and bank account.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/app/(lawyer)/lawyer/payouts/_components/method-form.tsx
"use client";

import { useState, useTransition } from "react";
import { Wallet } from "lucide-react";
import { addPayoutMethod } from "@/lib/actions/payouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function MethodForm() {
  const [type, setType] = useState<"gcash" | "maya" | "bank">("gcash");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isBank = type === "bank";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    start(async () => {
      try {
        await addPayoutMethod({
          type,
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim(),
          bankBic: isBank ? bankBic.trim() : null,
        });
        setSuccess(true);
        setAccountNumber("");
        setAccountHolderName("");
        setBankBic("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Wallet className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Add payout method
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pm-type" className="text-xs">
              Type
            </Label>
            <select
              id="pm-type"
              value={type}
              onChange={(e) => setType(e.target.value as "gcash" | "maya" | "bank")}
              className={SELECT_CLASS}
            >
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bank">Bank account</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pm-account" className="text-xs">
              {isBank ? "Account number" : "Mobile number"}
            </Label>
            <Input
              id="pm-account"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={isBank ? "Bank account number" : "09171234567"}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pm-holder" className="text-xs">
              Account holder name
            </Label>
            <Input
              id="pm-holder"
              required
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>

          {isBank ? (
            <div className="space-y-1.5">
              <Label htmlFor="pm-bic" className="text-xs">
                Bank (BIC / institution code)
              </Label>
              <Input
                id="pm-bic"
                required
                value={bankBic}
                onChange={(e) => setBankBic(e.target.value)}
                placeholder="e.g. BOPIPHMM"
                className="font-mono uppercase"
              />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Verified personal wallets cap around ₱100,000/month incoming — add a
              bank account if you expect larger payouts.
            </p>
          )}

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              Payout method added.
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Adding…" : "Add method"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(lawyer)/lawyer/payouts/_components/method-form.tsx
git commit -m "feat(web): payout method form"
```

---

## Task 3: Withdraw form (client component)

**Files:**
- Create: `apps/web/app/(lawyer)/lawyer/payouts/_components/withdraw-form.tsx`

Takes the available balance + the lawyer's methods. Disabled when there are no methods or nothing available. Client-side guards mirror `refund-form.tsx` (positive, ≤ available, ≥ minimum); the server is authoritative.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/app/(lawyer)/lawyer/payouts/_components/withdraw-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { requestWithdrawal } from "@/lib/actions/payouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Server enforces PAYOUT_MIN_CENTS; this is the client-side hint only.
const MIN_WITHDRAWAL_CENTS = 50000;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export type MethodOption = {
  id: string;
  type: "gcash" | "maya" | "bank";
  accountNumber: string;
  accountHolderName: string;
};

export function WithdrawForm({
  availableCents,
  methods,
}: {
  availableCents: number;
  methods: MethodOption[];
}) {
  const router = useRouter();
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState((availableCents / 100).toFixed(2));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const noMethods = methods.length === 0;
  const nothingAvailable = availableCents < MIN_WITHDRAWAL_CENTS;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (cents < MIN_WITHDRAWAL_CENTS) {
      setError(`Minimum withdrawal is ₱${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}`);
      return;
    }
    if (cents > availableCents) {
      setError(`You can withdraw at most ₱${(availableCents / 100).toFixed(2)}`);
      return;
    }
    if (!methodId) {
      setError("Choose a payout method");
      return;
    }
    start(async () => {
      try {
        await requestWithdrawal({ payoutMethodId: methodId, amountCents: cents });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function label(m: MethodOption) {
    const kind = m.type === "bank" ? "Bank" : m.type === "gcash" ? "GCash" : "Maya";
    return `${kind} · ${m.accountNumber} (${m.accountHolderName})`;
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Banknote className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Withdraw
        </p>
      </CardHeader>
      <CardContent>
        {noMethods ? (
          <p className="text-sm text-muted-foreground">
            Add a payout method first.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wd-method" className="text-xs">
                To
              </Label>
              <select
                id="wd-method"
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                className={SELECT_CLASS}
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {label(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wd-amount" className="text-xs">
                Amount · PHP
              </Label>
              <Input
                id="wd-amount"
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Available ₱{(availableCents / 100).toFixed(2)} · a ₱10 transfer fee
                is deducted from this amount.
              </p>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              type="submit"
              disabled={pending || nothingAvailable}
              className="w-full"
            >
              {pending ? "Requesting…" : "Request withdrawal"}
            </Button>
            {nothingAvailable ? (
              <p className="text-[11px] text-muted-foreground">
                Available balance is below the ₱
                {(MIN_WITHDRAWAL_CENTS / 100).toFixed(0)} minimum.
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(lawyer)/lawyer/payouts/_components/withdraw-form.tsx
git commit -m "feat(web): withdrawal request form"
```

---

## Task 4: Methods list (client component with delete)

**Files:**
- Create: `apps/web/app/(lawyer)/lawyer/payouts/_components/methods-list.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/app/(lawyer)/lawyer/payouts/_components/methods-list.tsx
"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePayoutMethod } from "@/lib/actions/payouts";
import { Button } from "@/components/ui/button";

export type MethodRow = {
  id: string;
  type: "gcash" | "maya" | "bank";
  accountNumber: string;
  accountHolderName: string;
  bankBic: string | null;
  verified: boolean;
};

export function MethodsList({ methods }: { methods: MethodRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (methods.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No payout methods yet.
      </p>
    );
  }

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    start(async () => {
      try {
        await deletePayoutMethod(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <ul className="divide-y divide-border/60">
      {error ? (
        <li className="px-4 py-2 text-xs text-destructive">{error}</li>
      ) : null}
      {methods.map((m) => {
        const kind = m.type === "bank" ? "Bank" : m.type === "gcash" ? "GCash" : "Maya";
        return (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{kind}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {m.accountNumber}
                </span>
                {m.verified ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    verified
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {m.accountHolderName}
                {m.bankBic ? ` · ${m.bankBic}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendingId === m.id}
              onClick={() => remove(m.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              {pendingId === m.id ? "Removing…" : "Remove"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(lawyer)/lawyer/payouts/_components/methods-list.tsx
git commit -m "feat(web): payout methods list with delete"
```

---

## Task 5: Lawyer Payouts page (server component)

**Files:**
- Create: `apps/web/app/(lawyer)/lawyer/payouts/page.tsx`

Fetches balance, methods, and payout history in parallel (each guarded by a local `safe`), renders a KPI strip (Available / Pending) + a two-column body: left = withdraw form + history table; right = method form + methods list. Follows the `Peso`/`shortDate`/`safe`/`KpiCard` conventions from `lawyer/invoices/page.tsx`.

- [ ] **Step 1: Write the page**

```tsx
// apps/web/app/(lawyer)/lawyer/payouts/page.tsx
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MethodForm } from "./_components/method-form";
import { MethodsList, type MethodRow } from "./_components/methods-list";
import { WithdrawForm, type MethodOption } from "./_components/withdraw-form";

type Balance = { availableCents: number; pendingCents: number; currency: string };
type PayoutRow = {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "returned";
  failureReason: string | null;
  requestedAt: string;
  completedAt: string | null;
  destinationSnapshot: { type?: string; accountNumber?: string } | null;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

function Peso({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

const STATUS_TONE: Record<PayoutRow["status"], string> = {
  pending: "text-amber-700 dark:text-amber-300",
  processing: "text-sky-700 dark:text-sky-300",
  succeeded: "text-emerald-700 dark:text-emerald-300",
  failed: "text-zinc-500",
  returned: "text-rose-700 dark:text-rose-300",
};

export default async function LawyerPayoutsPage() {
  const [balance, methodsResp, payoutsResp] = await Promise.all([
    safe<Balance>("/lawyer/payouts/balance", {
      availableCents: 0,
      pendingCents: 0,
      currency: "PHP",
    }),
    safe<{ items: MethodRow[] }>("/lawyer/payouts/methods", { items: [] }),
    safe<{ items: PayoutRow[] }>("/lawyer/payouts", { items: [] }),
  ]);

  const methodOptions: MethodOption[] = methodsResp.items.map((m) => ({
    id: m.id,
    type: m.type,
    accountNumber: m.accountNumber,
    accountHolderName: m.accountHolderName,
  }));

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Billing
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Payouts</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your earnings from paid invoices, withdrawable to GCash, Maya, or a bank
          account.
        </p>
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card size="sm" className="relative">
          <div
            className="absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-emerald-500 ring-1 ring-inset ring-emerald-200/60 dark:ring-emerald-900/30"
            aria-hidden
          />
          <CardContent>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Available
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              <Peso cents={balance.availableCents} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Ready to withdraw</p>
          </CardContent>
        </Card>
        <Card size="sm" className="relative">
          <div
            className="absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-amber-500 ring-1 ring-inset ring-amber-200/60 dark:ring-amber-900/30"
            aria-hidden
          />
          <CardContent>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Pending
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-muted-foreground">
              <Peso cents={balance.pendingCents} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clearing — available a few days after payment
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: withdraw + history */}
        <div className="space-y-6">
          <WithdrawForm
            availableCents={balance.availableCents}
            methods={methodOptions}
          />

          <Card className="gap-0 py-0">
            <CardContent className="px-0">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Withdrawal history
                </p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {payoutsResp.items.length} record
                  {payoutsResp.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Requested
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      To
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Net
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutsResp.items.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="px-4 py-12 text-center text-sm text-muted-foreground"
                      >
                        No withdrawals yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payoutsResp.items.map((p) => (
                      <TableRow key={p.id} className="hover:bg-transparent">
                        <TableCell className="pl-4 py-3 text-sm tabular-nums text-muted-foreground">
                          {shortDate(p.requestedAt)}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          <span className="capitalize">
                            {p.destinationSnapshot?.type ?? "—"}
                          </span>
                          {p.destinationSnapshot?.accountNumber ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {p.destinationSnapshot.accountNumber}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-3">
                          <span
                            className={cn(
                              "text-[11px] font-semibold uppercase tracking-wider",
                              STATUS_TONE[p.status],
                            )}
                          >
                            {p.status}
                          </span>
                          {p.failureReason ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {p.failureReason}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="pr-4 py-3 text-right text-sm font-medium">
                          <Peso cents={p.netCents} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right: methods */}
        <aside className="space-y-4 lg:self-start">
          <MethodForm />
          <Card className="gap-0 py-0">
            <CardHeader className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Payout methods
              </p>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <MethodsList methods={methodsResp.items} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(lawyer)/lawyer/payouts/page.tsx"
git commit -m "feat(web): lawyer payouts page (balance, withdraw, history, methods)"
```

---

## Task 6: Sidebar nav + breadcrumb label

**Files:**
- Modify: `apps/web/app/_components/portal-nav-config.ts`

- [ ] **Step 1: Add the icon import**

In the `lucide-react` import block at the top of `portal-nav-config.ts`, add `Wallet` (keep the list alphabetical-ish; it must appear before `type LucideIcon`):

```ts
  User,
  Users,
  Wallet,
  type LucideIcon,
```

- [ ] **Step 2: Add the lawyer nav item**

In the `LAWYER` config's `"Billing"` group `items` array, add after the Invoices line:

```ts
        { href: "/lawyer/payouts", label: "Payouts", icon: Wallet },
```

- [ ] **Step 3: Add the admin nav item**

In the `ADMIN` config's `"Money"` group `items` array, add after the Invoices line:

```ts
        { href: "/admin/payouts", label: "Payouts", icon: Wallet },
```

- [ ] **Step 4: Add the breadcrumb segment label**

In the `SEGMENT_LABELS` record, add:

```ts
  payouts: "Payouts",
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/_components/portal-nav-config.ts
git commit -m "feat(web): add Payouts to lawyer + admin sidebar nav"
```

---

## Task 7: Admin payouts read endpoint (API)

**Files:**
- Modify: `apps/api/src/routes/payouts.ts` (add `adminPayouts` export)
- Modify: `apps/api/src/app.ts` (mount it)
- Test: `apps/api/src/routes/admin-payouts.test.ts`

A small `requireRole("admin")` router so the admin list page has a data source. Read-only: lists all payouts joined to the lawyer's user row, newest first, optional `?status=` filter.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/admin-payouts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { rows, mockSelectChain, mockDb } = vi.hoisted(() => {
  const rows = [
    {
      payout: { id: "po_1", lawyerId: "law_1", amountCents: 60000, feeCents: 1000, netCents: 59000, status: "succeeded", currency: "PHP", requestedAt: new Date(), completedAt: new Date(), destinationSnapshot: { type: "gcash" } },
      lawyerName: "Atty. Juan", lawyerEmail: "juan@x.test",
    },
  ];
  // db().select().from().leftJoin().where().orderBy()  → rows
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const leftJoin = vi.fn().mockReturnValue({ where, orderBy });
  const from = vi.fn().mockReturnValue({ leftJoin });
  const mockSelectChain = { from };
  const mockDb = { select: vi.fn().mockReturnValue(mockSelectChain) };
  return { rows, mockSelectChain, mockDb };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: { payouts: { lawyerId: "lawyer_id", status: "status", createdAt: "created_at" }, user: { id: "id", name: "name", email: "email" } },
}));
vi.mock("../middleware/session", () => ({
  requireRole: () => async (c: any, next: any) => {
    c.set("user", { id: "admin_1", role: "admin" });
    await next();
  },
  requireSession: async (c: any, next: any) => next(),
}));
vi.mock("../lib/env", () => ({ env: () => ({}) }));
vi.mock("../lib/paymongo", () => ({ createBatchTransfer: vi.fn(), PaymongoApiError: class {}, PaymongoUnreachableError: class {} }));
vi.mock("../lib/transfer-webhook", () => ({ applyTransferWebhook: vi.fn() }));

import { adminPayouts } from "./payouts";

describe("adminPayouts GET /", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns payouts with lawyer info", async () => {
    const res = await adminPayouts.request("/", { method: "GET" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ id: "po_1", lawyer: { name: "Atty. Juan" } });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ligala/api test -- admin-payouts`
Expected: FAIL — `adminPayouts` not exported.

- [ ] **Step 3: Implement the router**

Append to `apps/api/src/routes/payouts.ts`:

```ts
/**
 * Admin payout queue (read-only). Mounted at /admin/payouts.
 */
export const adminPayouts = new Hono()
  .use("*", requireRole("admin"))
  .get("/", async (c) => {
    const status = c.req.query("status");
    const conn = db();
    const base = conn
      .select({
        payout: schema.payouts,
        lawyerName: schema.user.name,
        lawyerEmail: schema.user.email,
      })
      .from(schema.payouts)
      .leftJoin(schema.user, eq(schema.user.id, schema.payouts.lawyerId));
    const rows = status
      ? await base
          .where(eq(schema.payouts.status, status as never))
          .orderBy(desc(schema.payouts.createdAt))
      : await base.orderBy(desc(schema.payouts.createdAt));
    return c.json({
      items: rows.map((r) => ({
        ...r.payout,
        lawyer: r.lawyerName ? { name: r.lawyerName, email: r.lawyerEmail } : null,
      })),
    });
  });
```

- [ ] **Step 4: Mount the router**

In `apps/api/src/app.ts`, update the payouts import and add the mount near the other `/admin` routes:

```ts
import { payouts, payoutsDev, adminPayouts } from "./routes/payouts";
```

```ts
  app.route("/admin/payouts", adminPayouts);
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @ligala/api test -- admin-payouts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/payouts.ts apps/api/src/routes/admin-payouts.test.ts apps/api/src/app.ts
git commit -m "feat(api): admin payouts read endpoint"
```

---

## Task 8: Admin payouts list page

**Files:**
- Create: `apps/web/app/(admin)/admin/payouts/page.tsx`

Read-only list mirroring `admin/invoices/page.tsx`: a status filter bar + a table of every payout with the lawyer, amount/net, status, and dates.

- [ ] **Step 1: Write the page**

```tsx
// apps/web/app/(admin)/admin/payouts/page.tsx
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PayoutRow = {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "returned";
  provider: string;
  failureReason: string | null;
  requestedAt: string;
  completedAt: string | null;
  destinationSnapshot: { type?: string; accountNumber?: string } | null;
  lawyer: { name: string; email: string } | null;
};

const STATUS_OPTIONS = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "returned",
] as const;

const STATUS_TONE: Record<PayoutRow["status"], string> = {
  pending: "text-amber-700 dark:text-amber-300",
  processing: "text-sky-700 dark:text-sky-300",
  succeeded: "text-emerald-700 dark:text-emerald-300",
  failed: "text-zinc-500",
  returned: "text-rose-700 dark:text-rose-300",
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

function Peso({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusVal = sp["status"];
  const status = (Array.isArray(statusVal) ? statusVal[0] : statusVal) ?? "";
  const queryStr = status ? `?status=${encodeURIComponent(status)}` : "";

  const { items } = await safe<{ items: PayoutRow[] }>(
    `/admin/payouts${queryStr}`,
    { items: [] },
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Admin · Money
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Payouts</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {items.length.toLocaleString("en-PH")} payout
          {items.length === 1 ? "" : "s"} across all lawyers.
        </p>
      </header>

      <Card size="sm" className="mt-6 gap-0 py-0">
        <CardContent className="px-2 py-2">
          <form className="flex flex-wrap items-center gap-2">
            <select name="status" defaultValue={status} className={SELECT_CLASS}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit">Filter</Button>
            {status ? (
              <Button asChild variant="ghost">
                <Link href="/admin/payouts">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Requested
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Lawyer
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Destination
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Net
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    {status ? "No payouts match this status." : "No payouts yet."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <TableRow key={p.id} className="hover:bg-transparent">
                    <TableCell className="pl-4 py-3 text-sm tabular-nums text-muted-foreground">
                      {shortDate(p.requestedAt)}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <div className="font-medium">{p.lawyer?.name ?? "—"}</div>
                      {p.lawyer?.email ? (
                        <div className="text-xs text-muted-foreground">
                          {p.lawyer.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <span className="capitalize">
                        {p.destinationSnapshot?.type ?? "—"}
                      </span>
                      {p.destinationSnapshot?.accountNumber ? (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {p.destinationSnapshot.accountNumber}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wider",
                          STATUS_TONE[p.status],
                        )}
                      >
                        {p.status}
                      </span>
                      {p.failureReason ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.failureReason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm">
                      <Peso cents={p.amountCents} className="text-muted-foreground" />
                    </TableCell>
                    <TableCell className="pr-4 py-3 text-right text-sm font-medium">
                      <Peso cents={p.netCents} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/admin/payouts/page.tsx"
git commit -m "feat(web): admin payouts list page"
```

---

## Task 9: Verification gate + smoke

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the graph**

Run: `pnpm typecheck`
Expected: PASS across all packages.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS (Next build compiles the new routes/components).

- [ ] **Step 4: Manual smoke (local, requires Plan 1 backend running)**

With `docker compose up -d` + `pnpm dev`, signed in as a **KYC-approved** lawyer who has a cleared balance (set `PAYOUT_CLEARING_DAYS=0` locally; pay a case invoice via the dev-simulate flow to credit earnings):
1. Sidebar shows **Payouts** under Billing → open `/lawyer/payouts`. Available/Pending reflect the ledger.
2. Add a GCash method (right column) → it appears in the methods list.
3. Request a withdrawal for an amount ≥ ₱500 and ≤ available → it appears in history as `pending` (dev_simulate) or `processing`.
4. Simulate completion (Plan 1 dev route: `POST /lawyer/payouts/dev/simulate-transfer?payoutId=<id>&status=succeeded`) → refresh; history shows `succeeded`, Available dropped by the amount.
5. As an **admin**, open `/admin/payouts` → the withdrawal is listed with the lawyer's name; the status filter narrows the list.
6. Below-minimum and over-available withdrawals are rejected with an inline error.

Expected: all of the above behave as described.

- [ ] **Step 5: (Optional) Playwright spec**

If adding e2e coverage, create `tests/e2e/lawyer-payouts.spec.ts` following the existing serial specs: sign in as a seeded KYC-approved lawyer with a credited balance, add a method, request a withdrawal, assert it appears in history. Run `pnpm test:e2e -- lawyer-payouts`. (Skip if the seed lacks a cleared-balance fixture — track as a follow-up rather than blocking.)

- [ ] **Step 6: Update PROCESS.md**

Append a short line noting the lawyer + admin payouts **web UI** landed (Plan 2), complementing the backend (Plan 1). Do not restructure existing content.

- [ ] **Step 7: Commit**

```bash
git add PROCESS.md
git commit -m "docs: mark lawyer-payouts web UI complete in PROCESS.md"
```

---

## Self-review notes (coverage against spec §6 / §10)

- §10 "lawyer Payouts portal page (balance, ledger, methods, withdraw)" → Tasks 2–5.
- §10 "all mutations go through Server Actions → shared Zod → api" → Task 1 (parses `payoutMethodInput`/`withdrawalInput`).
- §10 "admin read views for the payout queue" → Tasks 7 (API) + 8 (page).
- §6 destinations GCash/Maya/bank → Task 2 (type select + conditional `bankBic`); §6 e-wallet ₱100k/mo nudge → Task 2 hint copy.
- §6 minimum withdrawal → Task 3 client hint (server authoritative).
- §10 admin `adjustment` (audited) → explicitly deferred (needs a new backend mutation; noted in scope).
- Nav discoverability → Task 6.
- Type consistency: `MethodRow` (Task 4) / `MethodOption` (Task 3) / `PayoutRow` (Tasks 5, 8) field names match the Plan 1 API response shapes (`amountCents`/`feeCents`/`netCents`/`status`/`destinationSnapshot`/`requestedAt`).
```

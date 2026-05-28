// apps/web/app/(lawyer)/lawyer/payouts/page.tsx
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
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
  return phDateFormat({
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
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

import Link from "next/link";
import { ArrowUpRight, TicketPercent } from "lucide-react";
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
import { StatusPill, isOverdue } from "@/app/_components/invoice-status";

type InvoiceRow = {
  id: string;
  number: string;
  status: "draft" | "sent" | "partially_paid" | "paid" | "void";
  kind: "case" | "subscription";
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  counterparty: { name: string; email: string } | null;
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

function Peso({
  cents,
  className,
  tone = "default",
}: {
  cents: number;
  className?: string;
  tone?: "default" | "muted";
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

export default async function LawyerInvoicesPage() {
  const { items } = await safe<{ items: InvoiceRow[] }>("/billing/invoices", {
    items: [],
  });
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const outstanding = items.filter(
    (i) => i.status === "sent" || i.status === "partially_paid",
  );
  const outstandingCents = outstanding.reduce(
    (s, i) => s + (i.totalCents - i.paidCents),
    0,
  );
  const overdue = outstanding.filter((i) => isOverdue(i.dueAt, i.status, now));
  const overdueCents = overdue.reduce(
    (s, i) => s + (i.totalCents - i.paidCents),
    0,
  );
  const collected30 = items.filter(
    (i) => i.paidAt && new Date(i.paidAt) >= thirtyDaysAgo,
  );
  const collected30Cents = collected30.reduce((s, i) => s + i.paidCents, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Header ----------------------------------------------------------- */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Billing
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Invoices
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {items.length === 0
              ? "Nothing issued yet."
              : `${items.length} total · ${outstanding.length} open${
                  overdue.length > 0 ? ` · ${overdue.length} overdue` : ""
                }`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/lawyer/discount-codes">
            <TicketPercent />
            Discount codes
            <ArrowUpRight className="opacity-60" />
          </Link>
        </Button>
      </header>

      {/* KPI strip -------------------------------------------------------- */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Outstanding"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={<Peso cents={outstandingCents} />}
          secondary={`${outstanding.length} invoice${
            outstanding.length === 1 ? "" : "s"
          } awaiting payment`}
        />
        <KpiCard
          label="Overdue"
          accent="bg-rose-500"
          accentRing="ring-rose-200/60 dark:ring-rose-900/30"
          primary={<Peso cents={overdueCents} />}
          secondary={
            overdue.length === 0
              ? "Nothing past due"
              : `${overdue.length} past due date`
          }
          muted={overdue.length === 0}
        />
        <KpiCard
          label="Collected · 30d"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<Peso cents={collected30Cents} />}
          secondary={`${collected30.length} payment${
            collected30.length === 1 ? "" : "s"
          } received`}
        />
      </section>

      {/* Table ------------------------------------------------------------ */}
      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Invoice
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Client
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Issued
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Due
                </TableHead>
                <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Total
                </TableHead>
                <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Paid
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    No invoices yet. Open a case to issue your first invoice.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((inv) => {
                  const overdueRow = isOverdue(inv.dueAt, inv.status, now);
                  const counterparty =
                    inv.kind === "subscription"
                      ? "Your subscription"
                      : inv.counterparty?.name ?? "—";
                  return (
                    <TableRow
                      key={inv.id}
                      className={cn(
                        "group transition-colors",
                        overdueRow && "shadow-[inset_2px_0_0_0_#f43f5e]",
                      )}
                    >
                      <TableCell className="pl-4 py-3">
                        <Link
                          href={`/lawyer/invoices/${inv.id}` as never}
                          className="font-mono text-sm font-medium tracking-tight hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <StatusPill status={inv.status} />
                          {overdueRow ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                              overdue
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        <span className="font-medium">{counterparty}</span>
                        {inv.kind === "case" && inv.counterparty?.email ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {inv.counterparty.email}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 text-sm tabular-nums text-muted-foreground">
                        {shortDate(inv.sentAt ?? inv.createdAt)}
                      </TableCell>
                      <TableCell className="py-3 text-sm tabular-nums">
                        <span
                          className={cn(
                            "text-muted-foreground",
                            overdueRow && "font-medium text-rose-600",
                          )}
                        >
                          {shortDate(inv.dueAt)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-medium">
                        <Peso cents={inv.totalCents} />
                      </TableCell>
                      <TableCell className="pr-4 py-3 text-right text-sm">
                        {inv.paidCents > 0 ? (
                          <Peso
                            cents={inv.paidCents}
                            className="text-emerald-700 dark:text-emerald-400"
                          />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function KpiCard({
  label,
  accent,
  accentRing,
  primary,
  secondary,
  muted = false,
}: {
  label: string;
  accent: string;
  accentRing: string;
  primary: React.ReactNode;
  secondary: string;
  muted?: boolean;
}) {
  return (
    <Card size="sm" className="relative">
      <div
        className={cn(
          "absolute inset-y-3 left-0 w-[2px] rounded-r-full ring-1 ring-inset",
          accent,
          accentRing,
          muted && "opacity-40",
        )}
        aria-hidden
      />
      <CardContent>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight",
            muted && "text-muted-foreground",
          )}
        >
          {primary}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
      </CardContent>
    </Card>
  );
}

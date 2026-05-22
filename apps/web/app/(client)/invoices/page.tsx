import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
  totalCents: number;
  paidCents: number;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
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
}: {
  cents: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

export default async function ClientInvoicesPage() {
  const { items } = await safe<{ items: InvoiceRow[] }>("/billing/invoices", {
    items: [],
  });
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const payable = items.filter(
    (i) => i.status === "sent" || i.status === "partially_paid",
  );
  const toPayCents = payable.reduce(
    (s, i) => s + (i.totalCents - i.paidCents),
    0,
  );
  const overdue = payable.filter((i) => isOverdue(i.dueAt, i.status, now));
  const overdueCents = overdue.reduce(
    (s, i) => s + (i.totalCents - i.paidCents),
    0,
  );
  const paidYTD = items.filter(
    (i) => i.paidAt && new Date(i.paidAt) >= yearStart,
  );
  const paidYTDCents = paidYTD.reduce((s, i) => s + i.paidCents, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
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
              ? "Nothing here yet. Your lawyer will issue invoices for accepted cases."
              : payable.length === 0
                ? "You're all paid up."
                : `${payable.length} invoice${
                    payable.length === 1 ? "" : "s"
                  } awaiting payment${
                    overdue.length > 0 ? ` · ${overdue.length} overdue` : ""
                  }`}
          </p>
        </div>
      </header>

      {/* KPI strip -------------------------------------------------------- */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="To pay"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={<Peso cents={toPayCents} />}
          secondary={
            payable.length === 0
              ? "Nothing due"
              : `Across ${payable.length} invoice${
                  payable.length === 1 ? "" : "s"
                }`
          }
          muted={payable.length === 0}
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
          label={`Paid · ${now.getFullYear()}`}
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<Peso cents={paidYTDCents} />}
          secondary={`${paidYTD.length} invoice${
            paidYTD.length === 1 ? "" : "s"
          } cleared this year`}
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
                  From
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Due
                </TableHead>
                <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    You have no invoices yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((inv) => {
                  const overdueRow = isOverdue(inv.dueAt, inv.status, now);
                  const remaining = Math.max(0, inv.totalCents - inv.paidCents);
                  const canPay =
                    (inv.status === "sent" || inv.status === "partially_paid") &&
                    remaining > 0;
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
                          href={`/invoices/${inv.id}` as never}
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
                        <span className="font-medium">
                          {inv.counterparty?.name ?? "—"}
                        </span>
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
                        {inv.paidCents > 0 && inv.paidCents < inv.totalCents ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            <Peso cents={remaining} /> remaining
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="pr-4 py-3 text-right">
                        {canPay ? (
                          <Button
                            asChild
                            size="xs"
                            variant={overdueRow ? "default" : "outline"}
                            className={cn(
                              "rounded-full",
                              overdueRow &&
                                "bg-rose-600 text-white hover:bg-rose-700",
                            )}
                          >
                            <Link href={`/invoices/${inv.id}` as never}>
                              Pay
                              <ArrowUpRight />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            asChild
                            size="xs"
                            variant="ghost"
                            className="text-muted-foreground"
                          >
                            <Link href={`/invoices/${inv.id}` as never}>
                              View
                            </Link>
                          </Button>
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

import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  createdAt: string;
  lawyer: { name: string; email: string } | null;
  client: { name: string; email: string } | null;
};

type Resp = {
  items: InvoiceRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    outstandingCents: number;
    overdueCents: number;
    collected30Cents: number;
    outstandingCount: number;
    overdueCount: number;
  };
};

const STATUS_OPTIONS = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "void",
] as const;

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

// Native <select> styled to match shadcn Input so it submits cleanly with the
// surrounding HTML form. Switching to the Radix-based Select would require
// client-side form state.
const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const q = pick("q") ?? "";
  const status = pick("status") ?? "";
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";

  const resp = await safe<Resp>(`/admin/invoices${queryStr}`, {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    stats: {
      outstandingCents: 0,
      overdueCents: 0,
      collected30Cents: 0,
      outstandingCount: 0,
      overdueCount: 0,
    },
  });
  const now = new Date();
  const pageStart = (resp.page - 1) * resp.pageSize;
  const pageEnd = Math.min(resp.total, pageStart + resp.items.length);
  const totalPages = Math.max(1, Math.ceil(resp.total / resp.pageSize));

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams(qs.toString());
    if (targetPage > 1) params.set("page", String(targetPage));
    const s = params.toString();
    return s ? `/admin/invoices?${s}` : "/admin/invoices";
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Header ----------------------------------------------------------- */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Admin · Billing
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Invoices
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {resp.total.toLocaleString("en-PH")} invoice
            {resp.total === 1 ? "" : "s"} on the platform · click a row to view
            payments and issue a refund.
          </p>
        </div>
      </header>

      {/* KPI strip (global, unfiltered) ----------------------------------- */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Outstanding"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={<Peso cents={resp.stats.outstandingCents} />}
          secondary={`${resp.stats.outstandingCount} open invoice${
            resp.stats.outstandingCount === 1 ? "" : "s"
          }`}
        />
        <KpiCard
          label="Overdue"
          accent="bg-rose-500"
          accentRing="ring-rose-200/60 dark:ring-rose-900/30"
          primary={<Peso cents={resp.stats.overdueCents} />}
          secondary={
            resp.stats.overdueCount === 0
              ? "Nothing past due"
              : `${resp.stats.overdueCount} past due date`
          }
          muted={resp.stats.overdueCount === 0}
        />
        <KpiCard
          label="Collected · 30d"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<Peso cents={resp.stats.collected30Cents} />}
          secondary="Across all lawyers"
        />
      </section>

      {/* Filter bar ------------------------------------------------------- */}
      <Card size="sm" className="mt-6 gap-0 py-0">
        <CardContent className="px-2 py-2">
          <form className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search by invoice number…"
                className="pl-9 font-mono placeholder:font-sans placeholder:text-muted-foreground/70"
              />
            </div>
            <select
              name="status"
              defaultValue={status}
              className={SELECT_CLASS}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <Button type="submit">Filter</Button>
            {q || status ? (
              <Button asChild variant="ghost">
                <Link href="/admin/invoices">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Table ------------------------------------------------------------ */}
      <Card className="mt-4 gap-0 py-0">
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
                  Lawyer
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Client
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Created
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
              {resp.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    {q || status
                      ? "No invoices match your filter."
                      : "No invoices on the platform yet."}
                  </TableCell>
                </TableRow>
              ) : (
                resp.items.map((inv) => {
                  const overdueRow = isOverdue(inv.dueAt, inv.status, now);
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
                          href={`/admin/invoices/${inv.id}` as never}
                          className="font-mono text-sm font-medium tracking-tight hover:underline"
                        >
                          {inv.number}
                        </Link>
                        {inv.kind === "subscription" ? (
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            subscription
                          </div>
                        ) : null}
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
                        <div className="font-medium">
                          {inv.lawyer?.name ?? "—"}
                        </div>
                        {inv.lawyer?.email ? (
                          <div className="text-xs text-muted-foreground">
                            {inv.lawyer.email}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {inv.client ? (
                          <>
                            <div className="font-medium">{inv.client.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {inv.client.email}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm tabular-nums text-muted-foreground">
                        {shortDate(inv.createdAt)}
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
          {/* Pagination footer */}
          {resp.total > resp.pageSize ? (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {resp.total === 0
                  ? "0 results"
                  : `${pageStart + 1}–${pageEnd} of ${resp.total.toLocaleString(
                      "en-PH",
                    )}`}
              </span>
              <div className="flex items-center gap-1">
                {resp.page <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft />
                    Prev
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(resp.page - 1) as never}>
                      <ChevronLeft />
                      Prev
                    </Link>
                  </Button>
                )}
                <span className="px-2 tabular-nums">
                  {resp.page} / {totalPages}
                </span>
                {resp.page >= totalPages ? (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight />
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(resp.page + 1) as never}>
                      Next
                      <ChevronRight />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : null}
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

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  CircleDashed,
  Hash,
  Receipt,
  TicketPercent,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import {
  applyDiscount,
  checkoutInvoice,
  sendInvoice,
  voidInvoice,
} from "@/lib/actions/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/app/_components/invoice-status";

export type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  notesMd: string | null;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt?: string;
};

export type Line = {
  id: string;
  description: string;
  qtyThousandths: number;
  unitAmountCents: number;
  lineTotalCents: number;
};

export type PaymentRow = {
  id: string;
  provider: string;
  providerPaymentId?: string;
  status: string;
  amountCents: number;
  refundedCents?: number;
  currency: string;
  createdAt: string;
};

export type TxRow = {
  id: string;
  kind: string;
  direction: string;
  amountCents: number;
  currency: string;
  note: string | null;
  createdAt: string;
};

export type AppliedCode = {
  code: string;
  kind: "percent" | "fixed";
  valueBps: number | null;
  valueCents: number | null;
} | null;

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function Peso({
  cents,
  className,
  sign,
}: {
  cents: number;
  className?: string;
  sign?: "+" | "−";
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {sign ? <span className="mr-px">{sign}</span> : null}
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

function longDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relativeDay(iso: string | null, now: Date = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function InvoiceDetail({
  viewerRole,
  invoice,
  lines,
  payments,
  transactions,
  appliedCode,
  renderPaymentAction,
}: {
  viewerRole: "client" | "lawyer" | "admin";
  invoice: InvoiceRow;
  lines: Line[];
  payments: PaymentRow[];
  transactions: TxRow[];
  appliedCode: AppliedCode;
  renderPaymentAction?: (payment: PaymentRow) => ReactNode;
}) {
  const remaining = Math.max(0, invoice.totalCents - invoice.paidCents);
  const paidPct =
    invoice.totalCents > 0
      ? Math.min(100, (invoice.paidCents / invoice.totalCents) * 100)
      : 0;

  const now = new Date();
  const overdue =
    invoice.dueAt &&
    (invoice.status === "sent" || invoice.status === "partially_paid") &&
    new Date(invoice.dueAt).getTime() < now.getTime();

  const backHref =
    viewerRole === "lawyer"
      ? "/lawyer/invoices"
      : viewerRole === "admin"
        ? "/admin/invoices"
        : "/invoices";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Breadcrumb back -------------------------------------------------- */}
      <Link
        href={backHref as never}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All invoices
      </Link>

      {/* Hero header ------------------------------------------------------ */}
      <header className="mt-3 border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {viewerRole === "admin"
            ? "Admin · Invoice"
            : viewerRole === "lawyer"
              ? "Billing · Invoice"
              : "Billing · Invoice"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-4xl font-semibold tracking-tight md:text-5xl">
            {invoice.number}
          </h1>
          <StatusPill status={invoice.status} className="text-[12px]" />
          {overdue ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600 ring-1 ring-rose-500/30">
              <TriangleAlert className="size-3" />
              Overdue
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {invoice.sentAt ? (
            <MetaInline
              icon={<ArrowUpRight className="size-3.5" />}
              label="Issued"
              value={longDate(invoice.sentAt) ?? "—"}
            />
          ) : invoice.createdAt ? (
            <MetaInline
              icon={<CircleDashed className="size-3.5" />}
              label="Created"
              value={longDate(invoice.createdAt) ?? "—"}
            />
          ) : null}
          {invoice.dueAt ? (
            <MetaInline
              icon={<Calendar className="size-3.5" />}
              label="Due"
              value={`${longDate(invoice.dueAt)} (${relativeDay(invoice.dueAt, now)})`}
              tone={overdue ? "danger" : "default"}
            />
          ) : null}
          {invoice.paidAt ? (
            <MetaInline
              icon={<CheckCircle2 className="size-3.5" />}
              label="Paid"
              value={longDate(invoice.paidAt) ?? "—"}
              tone="success"
            />
          ) : null}
          {invoice.voidedAt ? (
            <MetaInline
              icon={<XCircle className="size-3.5" />}
              label="Voided"
              value={longDate(invoice.voidedAt) ?? "—"}
              tone="muted"
            />
          ) : null}
        </div>
      </header>

      {/* Two-column body -------------------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column =================================================== */}
        <div className="space-y-6">
          {/* Line items ------------------------------------------------- */}
          <Card className="gap-0 py-0">
            <CardContent className="px-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <SectionLabel>Line items</SectionLabel>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {lines.length} item{lines.length === 1 ? "" : "s"}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Description
                    </TableHead>
                    <TableHead className="h-9 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Qty
                    </TableHead>
                    <TableHead className="h-9 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Unit
                    </TableHead>
                    <TableHead className="h-9 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        No line items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((l) => (
                      <TableRow key={l.id} className="hover:bg-transparent">
                        <TableCell className="pl-4 py-3 text-sm">
                          {l.description}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm tabular-nums text-muted-foreground">
                          {(l.qtyThousandths / 1000).toFixed(3)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm tabular-nums text-muted-foreground">
                          <Peso cents={l.unitAmountCents} />
                        </TableCell>
                        <TableCell className="pr-4 py-3 text-right text-sm font-medium">
                          <Peso cents={l.lineTotalCents} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes ------------------------------------------------------ */}
          {invoice.notesMd ? (
            <Card size="sm" className="gap-2">
              <CardHeader>
                <SectionLabel>Notes</SectionLabel>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/85">
                  {invoice.notesMd}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {/* Void reason banner ----------------------------------------- */}
          {invoice.voidedAt && invoice.voidReason ? (
            <Card
              size="sm"
              className="gap-2 ring-zinc-300 dark:ring-zinc-700 bg-muted/40"
            >
              <CardContent>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Void reason
                </p>
                <p className="mt-1 text-sm">{invoice.voidReason}</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Payments --------------------------------------------------- */}
          {payments.length > 0 ? (
            <Card className="gap-0 py-0">
              <CardContent className="px-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <SectionLabel>Payments</SectionLabel>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {payments.length} record{payments.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul>
                  {payments.map((p) => {
                    const refunded = p.refundedCents ?? 0;
                    const net = p.amountCents - refunded;
                    return (
                      <li
                        key={p.id}
                        className="border-b border-border/60 last:border-b-0 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <PaymentStatusDot status={p.status} />
                              <span className="text-sm font-medium capitalize">
                                {p.provider.replace("_", " ")}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-semibold uppercase tracking-wider",
                                  p.status === "succeeded"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : p.status === "refunded"
                                      ? "text-rose-700 dark:text-rose-300"
                                      : p.status === "failed"
                                        ? "text-zinc-500"
                                        : "text-amber-700 dark:text-amber-300",
                                )}
                              >
                                {p.status}
                              </span>
                            </div>
                            {p.providerPaymentId ? (
                              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                {p.providerPaymentId}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {longDate(p.createdAt)} · {timeOf(p.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Peso
                              cents={p.amountCents}
                              className="text-sm font-medium"
                            />
                            {refunded > 0 ? (
                              <div className="mt-0.5 text-[11px] tabular-nums text-rose-600">
                                refunded{" "}
                                <Peso cents={refunded} />
                              </div>
                            ) : null}
                            {refunded > 0 && net > 0 ? (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                net <Peso cents={net} />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {renderPaymentAction ? (
                          <div className="mt-2 flex justify-end">
                            {renderPaymentAction(p)}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Ledger / activity timeline ---------------------------------- */}
          {transactions.length > 0 ? (
            <Card size="sm" className="gap-3">
              <CardHeader className="flex-row items-center justify-between">
                <SectionLabel>Ledger</SectionLabel>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {transactions.length} event
                  {transactions.length === 1 ? "" : "s"}
                </span>
              </CardHeader>
              <CardContent>
                <Timeline events={transactions} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right column ================================================== */}
        <aside className="space-y-4 lg:self-start">
          {/* Summary ---------------------------------------------------- */}
          <Card size="sm" className="gap-3">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                <Peso cents={invoice.totalCents} />
              </p>

              {/* Progress bar */}
              <div className="mt-4">
                <div
                  className={cn(
                    "h-1.5 overflow-hidden rounded-full bg-muted",
                  )}
                  aria-label={`${paidPct.toFixed(0)}% paid`}
                >
                  <div
                    className={cn(
                      "h-full transition-all",
                      invoice.status === "paid"
                        ? "bg-emerald-500"
                        : invoice.status === "void"
                          ? "bg-zinc-400"
                          : "bg-sky-500",
                    )}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    Paid{" "}
                    <Peso
                      cents={invoice.paidCents}
                      className="text-emerald-700 dark:text-emerald-400"
                    />
                  </span>
                  <span className="tabular-nums">
                    Remaining <Peso cents={remaining} />
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <dl className="mt-5 space-y-1.5 border-t border-border/60 pt-4 text-sm">
                <SummaryRow
                  label="Subtotal"
                  value={<Peso cents={invoice.subtotalCents} />}
                />
                {invoice.discountCents > 0 ? (
                  <SummaryRow
                    label={
                      <span className="inline-flex items-center gap-1">
                        Discount
                        {appliedCode ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {appliedCode.code}
                          </span>
                        ) : null}
                      </span>
                    }
                    value={
                      <Peso
                        cents={invoice.discountCents}
                        sign="−"
                        className="text-muted-foreground"
                      />
                    }
                  />
                ) : null}
                <SummaryRow
                  label={<span className="font-medium">Total</span>}
                  value={
                    <span className="font-semibold">
                      <Peso cents={invoice.totalCents} />
                    </span>
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {/* Actions (role-aware) --------------------------------------- */}
          <ActionsPanel
            viewerRole={viewerRole}
            invoice={invoice}
            remaining={remaining}
          />

          {/* Metadata --------------------------------------------------- */}
          <Card size="sm" className="gap-2">
            <CardHeader>
              <SectionLabel>Details</SectionLabel>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-xs">
                <MetaRow
                  icon={<Hash className="size-3.5" />}
                  label="Currency"
                  value={
                    <span className="font-mono">{invoice.currency}</span>
                  }
                />
                {appliedCode ? (
                  <MetaRow
                    icon={<TicketPercent className="size-3.5" />}
                    label="Applied"
                    value={
                      <span className="font-mono">
                        {appliedCode.code} ·{" "}
                        {appliedCode.kind === "percent"
                          ? `${((appliedCode.valueBps ?? 0) / 100).toFixed(0)}%`
                          : "fixed"}
                      </span>
                    }
                  />
                ) : null}
                {invoice.createdAt ? (
                  <MetaRow
                    icon={<CircleDashed className="size-3.5" />}
                    label="Created"
                    value={longDate(invoice.createdAt) ?? "—"}
                  />
                ) : null}
                {invoice.sentAt ? (
                  <MetaRow
                    icon={<ArrowUpRight className="size-3.5" />}
                    label="Sent"
                    value={longDate(invoice.sentAt) ?? "—"}
                  />
                ) : null}
                {invoice.dueAt ? (
                  <MetaRow
                    icon={<Calendar className="size-3.5" />}
                    label="Due"
                    value={longDate(invoice.dueAt) ?? "—"}
                  />
                ) : null}
                {invoice.paidAt ? (
                  <MetaRow
                    icon={<CheckCircle2 className="size-3.5" />}
                    label="Paid"
                    value={longDate(invoice.paidAt) ?? "—"}
                  />
                ) : null}
                {invoice.voidedAt ? (
                  <MetaRow
                    icon={<XCircle className="size-3.5" />}
                    label="Voided"
                    value={longDate(invoice.voidedAt) ?? "—"}
                  />
                ) : null}
                <MetaRow
                  icon={<Receipt className="size-3.5" />}
                  label="Invoice ID"
                  value={
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {invoice.id.slice(0, 8)}…
                    </span>
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------- Tiny building blocks ----------------------------------------

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

function MetaInline({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "success" && "text-emerald-700 dark:text-emerald-300",
        tone === "danger" && "text-rose-700 dark:text-rose-300",
        tone === "muted" && "text-muted-foreground/70",
      )}
    >
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </span>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PaymentStatusDot({ status }: { status: string }) {
  const color =
    status === "succeeded"
      ? "bg-emerald-500"
      : status === "refunded"
        ? "bg-rose-500"
        : status === "failed"
          ? "bg-zinc-400"
          : "bg-amber-500";
  return (
    <span className={cn("inline-block size-2 rounded-full", color)} aria-hidden />
  );
}

function Timeline({ events }: { events: TxRow[] }) {
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border/60 pl-5">
      {events.map((t) => {
        const credit = t.direction === "credit";
        const isRefund = t.kind === "refund";
        const isFee = t.kind === "fee";
        const dot = isRefund
          ? "bg-rose-500"
          : isFee
            ? "bg-amber-500"
            : credit
              ? "bg-emerald-500"
              : "bg-zinc-500";
        const sign = isRefund ? "−" : credit ? "+" : "−";
        const amountClass = isRefund
          ? "text-rose-700 dark:text-rose-400"
          : credit
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-foreground";
        return (
          <li key={t.id} className="relative">
            <span
              className={cn(
                "absolute -left-[27px] top-1.5 size-2 rounded-full ring-4 ring-background",
                dot,
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium capitalize">{t.kind}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t.note ? `${t.note} · ` : ""}
                  {longDate(t.createdAt)} · {timeOf(t.createdAt)}
                </p>
              </div>
              <Peso
                cents={t.amountCents}
                sign={sign}
                className={cn("text-sm font-medium", amountClass)}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Action panels -----------------------------------------------

function ActionsPanel({
  viewerRole,
  invoice,
  remaining,
}: {
  viewerRole: "client" | "lawyer" | "admin";
  invoice: InvoiceRow;
  remaining: number;
}) {
  // Compute which sub-panels to render.
  const isDraft = invoice.status === "draft";
  const isPayable =
    (invoice.status === "sent" || invoice.status === "partially_paid") &&
    remaining > 0;
  const isVoidable =
    invoice.status === "sent" || invoice.status === "partially_paid";
  const canDiscount =
    (invoice.status === "draft" || invoice.status === "sent") &&
    viewerRole !== "admin";

  const showLawyerSend = viewerRole === "lawyer" && isDraft;
  const showLawyerVoid = viewerRole === "lawyer" && isVoidable;
  const showClientPay = viewerRole === "client" && isPayable;
  const showDiscount = canDiscount;

  if (!showLawyerSend && !showLawyerVoid && !showClientPay && !showDiscount) {
    return null;
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <SectionLabel>Actions</SectionLabel>
      </CardHeader>
      <CardContent className="space-y-3">
        {showLawyerSend ? <SendAction invoice={invoice} /> : null}
        {showClientPay ? (
          <PayAction invoice={invoice} remaining={remaining} />
        ) : null}
        {showDiscount ? <DiscountAction invoice={invoice} /> : null}
        {showLawyerVoid ? <VoidAction invoice={invoice} /> : null}
      </CardContent>
    </Card>
  );
}

function SendAction({ invoice }: { invoice: InvoiceRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-md border border-sky-200/60 bg-sky-50/40 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
        Send to client
      </p>
      <p className="text-xs text-muted-foreground">
        Once sent, line items become immutable.
      </p>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={pending || invoice.totalCents <= 0}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await sendInvoice(invoice.id);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="w-full"
      >
        {pending ? "Sending…" : "Send invoice"}
      </Button>
    </div>
  );
}

function VoidAction({ invoice }: { invoice: InvoiceRow }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Void
      </p>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending || reason.length < 3}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await voidInvoice(invoice.id, { reason });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="w-full"
      >
        {pending ? "Voiding…" : "Void invoice"}
      </Button>
    </div>
  );
}

function DiscountAction({ invoice }: { invoice: InvoiceRow }) {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Discount code
      </p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="flex-1 font-mono uppercase tracking-wider"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || code.length < 3}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await applyDiscount(invoice.id, { code });
                setCode("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
        >
          Apply
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function PayAction({
  invoice,
  remaining,
}: {
  invoice: InvoiceRow;
  remaining: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay(provider: "paymongo" | "paypal" | "dev_simulate") {
    setError(null);
    start(async () => {
      try {
        const res = await checkoutInvoice(invoice.id, { provider });
        if (provider === "dev_simulate") {
          const r = await fetch(res.checkoutUrl, { method: "POST" });
          if (!r.ok) throw new Error(`simulate ${r.status}`);
          window.location.reload();
        } else {
          window.location.href = res.checkoutUrl;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-emerald-200/60 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
        Pay {invoice.totalCents > invoice.paidCents ? "remaining" : "invoice"}
      </p>
      <p className="text-sm font-medium">
        <Peso cents={remaining} />
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => pay("paymongo")}
        >
          PayMongo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => pay("paypal")}
        >
          PayPal
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => pay("dev_simulate")}
          className="col-span-2 border border-dashed border-border text-muted-foreground"
        >
          Dev · simulate
        </Button>
      </div>
    </div>
  );
}

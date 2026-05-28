import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Receipt,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardHero } from "@/app/_components/dashboard-hero";
import { StatusPill, isOverdue } from "@/app/_components/invoice-status";

type CaseRow = {
  id: string;
  title: string;
  type: "paid" | "probono";
  status:
    | "pending"
    | "declined"
    | "accepted"
    | "active"
    | "closed"
    | "cancelled";
  updatedAt: string;
  createdAt: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: "draft" | "sent" | "partially_paid" | "paid" | "void";
  kind: "case" | "subscription";
  totalCents: number;
  paidCents: number;
  dueAt: string | null;
  paidAt: string | null;
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

function Peso({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return phDateFormat({
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

const CASE_STATUS_DOT: Record<CaseRow["status"], string> = {
  pending: "bg-amber-500",
  declined: "bg-zinc-400",
  accepted: "bg-sky-500",
  active: "bg-emerald-500",
  closed: "bg-zinc-300",
  cancelled: "bg-zinc-300",
};

const CASE_STATUS_LABEL: Record<CaseRow["status"], string> = {
  pending: "Awaiting decision",
  declined: "Declined",
  accepted: "Accepted",
  active: "Active",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default async function ClientDashboard() {
  const session = await getSession();
  const [{ items: cases }, { items: invoices }] = await Promise.all([
    safe<{ items: CaseRow[] }>("/cases", { items: [] }),
    safe<{ items: InvoiceRow[] }>("/billing/invoices", { items: [] }),
  ]);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const activeCases = cases.filter(
    (c) => c.status === "active" || c.status === "accepted",
  );
  const pendingCases = cases.filter((c) => c.status === "pending");

  const payable = invoices.filter(
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
  const paidYTD = invoices
    .filter((i) => i.paidAt && new Date(i.paidAt) >= yearStart)
    .reduce((s, i) => s + i.paidCents, 0);

  const recentCases = cases.slice(0, 5);
  const recentInvoices = invoices.slice(0, 4);

  const summaryParts: string[] = [];
  if (payable.length > 0) {
    summaryParts.push(
      `${payable.length} invoice${payable.length === 1 ? "" : "s"} to pay`,
    );
  }
  if (overdue.length > 0) {
    summaryParts.push(`${overdue.length} overdue`);
  }
  if (pendingCases.length > 0) {
    summaryParts.push(
      `${pendingCases.length} case${
        pendingCases.length === 1 ? "" : "s"
      } awaiting a lawyer's decision`,
    );
  }
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : cases.length === 0
        ? "Welcome to Ligala. Start by finding a verified Philippine lawyer."
        : "Nothing urgent. Everything's on track.";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <DashboardHero
        eyebrow="Client · Dashboard"
        userName={session?.user.name}
        userEmail={session?.user.email ?? ""}
        summary={summary}
        actions={
          <Button asChild size="sm">
            <Link href="/lawyers">
              <Search />
              Find a lawyer
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active cases"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          primary={
            <span className="tabular-nums">{activeCases.length}</span>
          }
          secondary={
            pendingCases.length > 0
              ? `${pendingCases.length} awaiting decision`
              : "All decided"
          }
          muted={activeCases.length === 0}
        />
        <KpiCard
          label="To pay"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={<Peso cents={toPayCents} />}
          secondary={
            payable.length === 0
              ? "Nothing due"
              : `${payable.length} invoice${
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
          primary={<Peso cents={paidYTD} />}
          secondary="This year"
        />
      </section>

      {/* Body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: cases */}
        <Card className="min-w-0 gap-0 py-0">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Your cases
            </p>
            {cases.length > 0 ? (
              <Button asChild variant="ghost" size="xs">
                <Link href="/cases">
                  All cases
                  <ArrowUpRight />
                </Link>
              </Button>
            ) : null}
          </div>
          <CardContent className="px-0">
            {cases.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title="No cases yet"
                body="Start a legal matter by finding a lawyer that fits your need."
                cta={
                  <Button asChild size="sm">
                    <Link href="/lawyers">
                      <Search />
                      Find a lawyer
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul>
                {recentCases.map((c) => (
                  <li
                    key={c.id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <Link
                      href={`/cases/${c.id}` as never}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              CASE_STATUS_DOT[c.status],
                            )}
                            aria-hidden
                          />
                          <span className="truncate text-sm font-medium">
                            {c.title}
                          </span>
                          {c.type === "probono" ? (
                            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Pro bono
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {CASE_STATUS_LABEL[c.status]} ·{" "}
                          <span className="tabular-nums">
                            updated {shortDate(c.updatedAt)}
                          </span>
                        </p>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/60" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right rail */}
        <aside className="min-w-0 space-y-4">
          {/* Recent invoices */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Recent invoices
              </p>
              {invoices.length > 0 ? (
                <Button asChild variant="ghost" size="xs">
                  <Link href="/invoices">
                    All
                    <ArrowUpRight />
                  </Link>
                </Button>
              ) : null}
            </div>
            <CardContent className="px-0">
              {invoices.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="size-5" />}
                  title="No invoices yet"
                  body="Your lawyer will issue invoices for accepted cases."
                />
              ) : (
                <ul>
                  {recentInvoices.map((inv) => {
                    const remaining = Math.max(
                      0,
                      inv.totalCents - inv.paidCents,
                    );
                    const overdueRow = isOverdue(inv.dueAt, inv.status, now);
                    return (
                      <li
                        key={inv.id}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <Link
                          href={`/invoices/${inv.id}` as never}
                          className={cn(
                            "flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                            overdueRow && "shadow-[inset_2px_0_0_0_#f43f5e]",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">
                                {inv.number}
                              </span>
                              <StatusPill status={inv.status} />
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {inv.counterparty?.name ?? "—"}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <Peso
                              cents={
                                remaining > 0 ? remaining : inv.totalCents
                              }
                              className="font-medium"
                            />
                            {remaining > 0 && inv.paidCents > 0 ? (
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                remaining
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card size="sm" className="gap-2">
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick links
              </p>
            </CardHeader>
            <CardContent className="grid gap-2">
              <QuickLink
                href="/lawyers"
                icon={<Search className="size-4" />}
                title="Find a lawyer"
                sub="Browse verified Philippine lawyers"
              />
              <QuickLink
                href="/lawyers?probono=true"
                icon={<Briefcase className="size-4" />}
                title="Pro bono lawyers"
                sub="Lawyers accepting pro bono cases"
              />
              <QuickLink
                href="/chapters"
                icon={<Building2 className="size-4" />}
                title="IBP chapters"
                sub="Browse by local bar chapter"
              />
            </CardContent>
          </Card>

          {/* Become a lawyer banner */}
          <Card
            size="sm"
            className="gap-1 ring-zinc-200 dark:ring-zinc-800 bg-gradient-to-br from-muted/40 to-transparent"
          >
            <CardContent>
              <p className="text-sm font-medium">Are you a lawyer?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                List your practice on Ligala and reach new clients.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link href="/become-a-lawyer">List my practice</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
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

function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
      {cta ? <div className="mt-2">{cta}</div> : null}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href as never}
      className="group flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-muted/40 hover:border-foreground/30"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {sub}
        </span>
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

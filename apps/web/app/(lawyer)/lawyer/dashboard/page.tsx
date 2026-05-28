import Link from "next/link";
import { phDateFormat } from "@/lib/datetime";
import {
  ArrowUpRight,
  Briefcase,
  Building,
  Inbox,
  Link2,
  Receipt,
  Share2,
  ShieldCheck,
  TicketPercent,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardHero } from "@/app/_components/dashboard-hero";
import { isOverdue } from "@/app/_components/invoice-status";

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
  createdAt: string;
  updatedAt: string;
};

type ReferralRow = {
  id: string;
  status: "pending" | "accepted" | "declined" | "completed";
  toLawyerId: string;
  fromLawyerId: string;
  createdAt: string;
};

type LinkRow = {
  id: string;
  slug: string;
  signups: number;
  active: boolean;
};

type InvoiceRow = {
  id: string;
  status: "draft" | "sent" | "partially_paid" | "paid" | "void";
  kind: "case" | "subscription";
  totalCents: number;
  paidCents: number;
  dueAt: string | null;
  paidAt: string | null;
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

export default async function LawyerDashboard() {
  const session = await getSession();
  const meId = session?.user.id ?? "";
  const [
    { items: cases },
    { items: referrals },
    { items: links },
    { items: invoices },
  ] = await Promise.all([
    safe<{ items: CaseRow[] }>("/cases", { items: [] }),
    safe<{ items: ReferralRow[] }>("/referrals", { items: [] }),
    safe<{ items: LinkRow[] }>("/referrals/links", { items: [] }),
    safe<{ items: InvoiceRow[] }>("/billing/invoices", { items: [] }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const pendingCases = cases.filter((c) => c.status === "pending");
  const activeCases = cases.filter(
    (c) => c.status === "active" || c.status === "accepted",
  );
  const inboundPending = referrals.filter(
    (r) => r.status === "pending" && r.toLawyerId === meId,
  );

  const outstanding = invoices.filter(
    (i) => i.status === "sent" || i.status === "partially_paid",
  );
  const outstandingCents = outstanding.reduce(
    (s, i) => s + (i.totalCents - i.paidCents),
    0,
  );
  const overdue = outstanding.filter((i) => isOverdue(i.dueAt, i.status, now));
  const collected30Cents = invoices
    .filter((i) => i.paidAt && new Date(i.paidAt) >= thirtyDaysAgo)
    .reduce((s, i) => s + i.paidCents, 0);

  const totalSignups = links.reduce((s, l) => s + l.signups, 0);
  const topLink = [...links].sort((a, b) => b.signups - a.signups)[0] ?? null;

  const summaryParts: string[] = [];
  if (pendingCases.length > 0) {
    summaryParts.push(
      `${pendingCases.length} case${
        pendingCases.length === 1 ? "" : "s"
      } awaiting your decision`,
    );
  }
  if (inboundPending.length > 0) {
    summaryParts.push(
      `${inboundPending.length} inbound referral${
        inboundPending.length === 1 ? "" : "s"
      }`,
    );
  }
  if (overdue.length > 0) {
    summaryParts.push(
      `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} overdue`,
    );
  }
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "Nothing urgent. Pipeline is calm.";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <DashboardHero
        eyebrow="Lawyer · Dashboard"
        userName={session?.user.name}
        userEmail={session?.user.email ?? ""}
        summary={summary}
      />

      {/* KPIs */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pending"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={
            <span className="tabular-nums">{pendingCases.length}</span>
          }
          secondary={
            pendingCases.length === 0
              ? "Inbox clear"
              : `${pendingCases.length} case${
                  pendingCases.length === 1 ? "" : "s"
                } need decisions`
          }
          muted={pendingCases.length === 0}
        />
        <KpiCard
          label="Active"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          primary={
            <span className="tabular-nums">{activeCases.length}</span>
          }
          secondary={`${cases.length} total ever`}
          muted={activeCases.length === 0}
        />
        <KpiCard
          label="Outstanding"
          accent="bg-rose-500"
          accentRing="ring-rose-200/60 dark:ring-rose-900/30"
          primary={<Peso cents={outstandingCents} />}
          secondary={`${outstanding.length} open invoice${
            outstanding.length === 1 ? "" : "s"
          }${overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}`}
          muted={outstanding.length === 0}
        />
        <KpiCard
          label="Collected · 30d"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<Peso cents={collected30Cents} />}
          secondary="Last 30 days"
        />
      </section>

      {/* Body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
        {/* Left: inbox + active cases */}
        <div className="space-y-4">
          {/* Inbox panel */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Inbox className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Inbox
                </p>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {pendingCases.length + inboundPending.length}
                </span>
              </div>
            </div>
            <CardContent className="px-0">
              {pendingCases.length === 0 && inboundPending.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="size-5" />}
                  title="Inbox is empty"
                  body="When clients submit cases or referrals come in, they'll land here."
                />
              ) : (
                <ul>
                  {pendingCases.map((c) => (
                    <li
                      key={`case-${c.id}`}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <Link
                        href={`/lawyer/cases/${c.id}` as never}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700 ring-1 ring-amber-200/60 dark:ring-amber-900/40 dark:text-amber-300">
                            <Briefcase className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {c.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              New case ·{" "}
                              {c.type === "probono" ? "Pro bono" : "Paid"} ·{" "}
                              <span className="tabular-nums">
                                {shortDate(c.createdAt)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          Review
                        </span>
                      </Link>
                    </li>
                  ))}
                  {inboundPending.map((r) => (
                    <li
                      key={`ref-${r.id}`}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <Link
                        href={`/lawyer/referrals` as never}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-700 ring-1 ring-sky-200/60 dark:ring-sky-900/40 dark:text-sky-300">
                            <Share2 className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              Inbound referral
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              From another lawyer ·{" "}
                              <span className="tabular-nums">
                                {shortDate(r.createdAt)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                          Respond
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Active cases */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Active cases
              </p>
              {cases.length > 0 ? (
                <Button asChild variant="ghost" size="xs">
                  <Link href="/lawyer/cases">
                    All cases
                    <ArrowUpRight />
                  </Link>
                </Button>
              ) : null}
            </div>
            <CardContent className="px-0">
              {activeCases.length === 0 ? (
                <EmptyState
                  icon={<Briefcase className="size-5" />}
                  title="No active matters"
                  body="Accepted cases move here once engagements are signed."
                />
              ) : (
                <ul>
                  {activeCases.slice(0, 5).map((c) => (
                    <li
                      key={c.id}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <Link
                        href={`/lawyer/cases/${c.id}` as never}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                c.status === "active"
                                  ? "bg-emerald-500"
                                  : "bg-sky-500",
                              )}
                              aria-hidden
                            />
                            <span className="truncate text-sm font-medium">
                              {c.title}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.status === "active"
                              ? "Active"
                              : "Accepted — awaiting engagement"}{" "}
                            ·{" "}
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
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          {/* Referral performance */}
          <Card size="sm" className="gap-3">
            <CardHeader className="flex-row items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Referral links
              </p>
              <Button asChild variant="ghost" size="xs">
                <Link href="/lawyer/referral-links">
                  Manage
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total signups
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {totalSignups}
                </p>
                <p className="text-xs text-muted-foreground">
                  Across {links.length} link{links.length === 1 ? "" : "s"}
                </p>
              </div>
              {topLink ? (
                <div className="rounded-md border border-border/60 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Top performer
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs">
                    /{topLink.slug}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {topLink.signups} signup{topLink.signups === 1 ? "" : "s"}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card size="sm" className="gap-2">
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Manage
              </p>
            </CardHeader>
            <CardContent className="grid gap-2">
              <QuickLink
                href="/lawyer/invoices"
                icon={<Receipt className="size-4" />}
                title="Invoices"
                sub="Bills, payments, ledger"
              />
              <QuickLink
                href="/lawyer/discount-codes"
                icon={<TicketPercent className="size-4" />}
                title="Discount codes"
                sub="Issue codes for clients"
              />
              <QuickLink
                href="/lawyer/referral-links"
                icon={<Link2 className="size-4" />}
                title="Referral links"
                sub="Trackable signup URLs"
              />
              <QuickLink
                href="/lawyer/profile"
                icon={<User className="size-4" />}
                title="Public profile"
                sub="Bio, practice areas, pro bono"
              />
              <QuickLink
                href="/lawyer/office"
                icon={<Building className="size-4" />}
                title="Office"
                sub="Address, schedule, FAQs"
              />
              <QuickLink
                href="/lawyer/kyc"
                icon={<ShieldCheck className="size-4" />}
                title="KYC"
                sub="Verification documents"
              />
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
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
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

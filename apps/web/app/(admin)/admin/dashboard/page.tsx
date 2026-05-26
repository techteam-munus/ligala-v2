import Link from "next/link";
import { phDateFormat } from "@/lib/datetime";
import {
  ArrowUpRight,
  Receipt,
  ScrollText,
  Share2,
  ShieldCheck,
  TicketPercent,
  TriangleAlert,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardHero } from "@/app/_components/dashboard-hero";

type Stats = {
  users: { role: string; status: string; count: number }[];
  kycPendingCount: number;
  invoicesPaidCount: number;
  refundsAllTime: number;
  activeReferrals: number;
};

type AuditAction =
  | "user_status_changed"
  | "user_role_changed"
  | "kyc_decided"
  | "kyc_force_approved"
  | "discount_code_removed"
  | "discount_code_created"
  | "invoice_refunded"
  | "invoice_voided"
  | "referral_force_decided"
  | "ibp_lawyer_added";

type AuditEntry = {
  log: {
    id: string;
    action: AuditAction;
    subjectType: string;
    subjectId: string;
    reason: string | null;
    createdAt: string;
  };
  actorName: string;
  actorEmail: string;
};

const ACTION_LABEL: Record<AuditAction, string> = {
  user_status_changed: "Changed user status",
  user_role_changed: "Changed user role",
  kyc_decided: "Decided KYC",
  kyc_force_approved: "Force-approved KYC",
  discount_code_removed: "Removed discount code",
  discount_code_created: "Created discount code",
  invoice_refunded: "Refunded invoice",
  invoice_voided: "Voided invoice",
  referral_force_decided: "Forced referral decision",
  ibp_lawyer_added: "Added IBP lawyer",
};

const ACTION_TONE: Record<AuditAction, "default" | "danger" | "warning"> = {
  user_status_changed: "warning",
  user_role_changed: "warning",
  kyc_decided: "default",
  kyc_force_approved: "warning",
  discount_code_removed: "danger",
  discount_code_created: "default",
  invoice_refunded: "danger",
  invoice_voided: "danger",
  referral_force_decided: "warning",
  ibp_lawyer_added: "default",
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return phDateFormat({
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default async function AdminDashboard() {
  const session = await getSession();
  const [stats, audit] = await Promise.all([
    safe<Stats>("/admin/stats", {
      users: [],
      kycPendingCount: 0,
      invoicesPaidCount: 0,
      refundsAllTime: 0,
      activeReferrals: 0,
    }),
    safe<{ items: AuditEntry[] }>("/admin/audit-log", { items: [] }),
  ]);

  const total = stats.users.reduce((a, u) => a + u.count, 0);
  const byRole = (role: string) =>
    stats.users.filter((u) => u.role === role).reduce((a, u) => a + u.count, 0);
  const byStatus = (status: string) =>
    stats.users
      .filter((u) => u.status === status)
      .reduce((a, u) => a + u.count, 0);

  const lawyers = byRole("lawyer");
  const clients = byRole("client");
  const admins = byRole("admin");
  const paused = byStatus("paused");
  const banned = byStatus("banned");

  const summaryParts: string[] = [];
  if (stats.kycPendingCount > 0) {
    summaryParts.push(
      `${stats.kycPendingCount} KYC submission${
        stats.kycPendingCount === 1 ? "" : "s"
      } pending`,
    );
  }
  if (paused + banned > 0) {
    summaryParts.push(
      `${paused + banned} account${paused + banned === 1 ? "" : "s"} paused or banned`,
    );
  }
  if (stats.activeReferrals > 0) {
    summaryParts.push(
      `${stats.activeReferrals} referral${
        stats.activeReferrals === 1 ? "" : "s"
      } pending`,
    );
  }
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "All quiet on the platform.";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <DashboardHero
        eyebrow="Admin · Dashboard"
        userName={session?.user.name}
        userEmail={session?.user.email ?? ""}
        summary={summary}
      />

      {/* KPIs */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          accent="bg-foreground/80"
          accentRing="ring-foreground/10"
          primary={
            <span className="tabular-nums">{total.toLocaleString("en-PH")}</span>
          }
          secondary={`${lawyers} lawyer${lawyers === 1 ? "" : "s"} · ${clients} client${
            clients === 1 ? "" : "s"
          } · ${admins} admin${admins === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Lawyers"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          primary={<span className="tabular-nums">{lawyers}</span>}
          secondary={
            total > 0 ? `${((lawyers / total) * 100).toFixed(0)}% of users` : "—"
          }
        />
        <KpiCard
          label="KYC pending"
          accent={stats.kycPendingCount > 0 ? "bg-amber-500" : "bg-emerald-500"}
          accentRing={
            stats.kycPendingCount > 0
              ? "ring-amber-200/60 dark:ring-amber-900/30"
              : "ring-emerald-200/60 dark:ring-emerald-900/30"
          }
          primary={
            <span className="tabular-nums">{stats.kycPendingCount}</span>
          }
          secondary={
            stats.kycPendingCount > 0 ? "Need review" : "Inbox clear"
          }
          muted={stats.kycPendingCount === 0}
        />
        <KpiCard
          label="Paused / banned"
          accent="bg-rose-500"
          accentRing="ring-rose-200/60 dark:ring-rose-900/30"
          primary={<span className="tabular-nums">{paused + banned}</span>}
          secondary={`${paused} paused · ${banned} banned`}
          muted={paused + banned === 0}
        />
      </section>

      {/* Body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Needs attention */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <TriangleAlert className="size-3.5 text-amber-600" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Needs your attention
                </p>
              </div>
            </div>
            <CardContent className="px-0">
              <ul>
                <AttentionRow
                  href="/admin/kyc"
                  icon={<ShieldCheck className="size-3.5" />}
                  iconClass="bg-amber-500/10 text-amber-700 ring-amber-200/60 dark:ring-amber-900/40 dark:text-amber-300"
                  title="KYC submissions"
                  sub={
                    stats.kycPendingCount === 0
                      ? "Nothing waiting"
                      : "Verify lawyer credentials"
                  }
                  count={stats.kycPendingCount}
                  muted={stats.kycPendingCount === 0}
                />
                <AttentionRow
                  href="/admin/referrals"
                  icon={<Share2 className="size-3.5" />}
                  iconClass="bg-sky-500/10 text-sky-700 ring-sky-200/60 dark:ring-sky-900/40 dark:text-sky-300"
                  title="Pending referrals"
                  sub="Force decisions when stuck"
                  count={stats.activeReferrals}
                  muted={stats.activeReferrals === 0}
                />
                <AttentionRow
                  href="/admin/users?status=paused"
                  icon={<UserCheck className="size-3.5" />}
                  iconClass="bg-rose-500/10 text-rose-700 ring-rose-200/60 dark:ring-rose-900/40 dark:text-rose-300"
                  title="Paused accounts"
                  sub="Review and unblock if appropriate"
                  count={paused}
                  muted={paused === 0}
                />
                <AttentionRow
                  href="/admin/users?status=banned"
                  icon={<XCircle className="size-3.5" />}
                  iconClass="bg-zinc-500/10 text-zinc-700 ring-zinc-200/60 dark:ring-zinc-700/40 dark:text-zinc-300"
                  title="Banned accounts"
                  sub="Permanent enforcement actions"
                  count={banned}
                  muted={banned === 0}
                />
              </ul>
            </CardContent>
          </Card>

          {/* User distribution bar */}
          <Card size="sm" className="gap-3">
            <CardHeader className="flex-row items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                User distribution
              </p>
              <Button asChild variant="ghost" size="xs">
                <Link href="/admin/users">
                  All users
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {total === 0 ? (
                <p className="text-xs text-muted-foreground">No users yet.</p>
              ) : (
                <>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-sky-500"
                      style={{ width: `${(lawyers / total) * 100}%` }}
                      title={`${lawyers} lawyers`}
                    />
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${(clients / total) * 100}%` }}
                      title={`${clients} clients`}
                    />
                    <div
                      className="bg-foreground"
                      style={{ width: `${(admins / total) * 100}%` }}
                      title={`${admins} admins`}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <DistLegend
                      color="bg-sky-500"
                      label="Lawyers"
                      value={lawyers}
                      pct={(lawyers / total) * 100}
                    />
                    <DistLegend
                      color="bg-emerald-500"
                      label="Clients"
                      value={clients}
                      pct={(clients / total) * 100}
                    />
                    <DistLegend
                      color="bg-foreground"
                      label="Admins"
                      value={admins}
                      pct={(admins / total) * 100}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Billing summary */}
          <Card size="sm" className="gap-3">
            <CardHeader className="flex-row items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Billing
              </p>
              <Button asChild variant="ghost" size="xs">
                <Link href="/admin/invoices">
                  All invoices
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Paid all-time
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {stats.invoicesPaidCount.toLocaleString("en-PH")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Refunds issued
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-600">
                    {stats.refundsAllTime.toLocaleString("en-PH")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right rail: audit log + quick links */}
        <aside className="space-y-4">
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <ScrollText className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Audit log
                </p>
              </div>
              <Button asChild variant="ghost" size="xs">
                <Link href="/admin/audit-log">
                  All
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
            <CardContent className="px-0">
              {audit.items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No admin activity yet.
                  </p>
                </div>
              ) : (
                <ol className="relative ml-4 border-l border-border/60 py-3">
                  {audit.items.slice(0, 6).map((e) => {
                    const tone = ACTION_TONE[e.log.action];
                    const dot =
                      tone === "danger"
                        ? "bg-rose-500"
                        : tone === "warning"
                          ? "bg-amber-500"
                          : "bg-sky-500";
                    return (
                      <li key={e.log.id} className="relative pb-3 pl-5 pr-4 last:pb-0">
                        <span
                          className={cn(
                            "absolute -left-[5px] top-1.5 size-2 rounded-full ring-4 ring-card",
                            dot,
                          )}
                          aria-hidden
                        />
                        <p className="text-xs font-medium">
                          {ACTION_LABEL[e.log.action]}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {e.actorName} · {relativeTime(e.log.createdAt)}
                        </p>
                        {e.log.reason ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                            &ldquo;{e.log.reason}&rdquo;
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card size="sm" className="gap-2">
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Jump to
              </p>
            </CardHeader>
            <CardContent className="grid gap-2">
              <QuickLink
                href="/admin/users"
                icon={<Users className="size-4" />}
                title="Users"
                sub={`${total.toLocaleString("en-PH")} total`}
              />
              <QuickLink
                href="/admin/kyc"
                icon={<ShieldCheck className="size-4" />}
                title="KYC inbox"
                sub={
                  stats.kycPendingCount > 0
                    ? `${stats.kycPendingCount} pending`
                    : "Up to date"
                }
              />
              <QuickLink
                href="/admin/invoices"
                icon={<Receipt className="size-4" />}
                title="Invoices"
                sub={`${stats.invoicesPaidCount} paid · ${stats.refundsAllTime} refunds`}
              />
              <QuickLink
                href="/admin/discount-codes"
                icon={<TicketPercent className="size-4" />}
                title="Discount codes"
                sub="Moderation"
              />
              <QuickLink
                href="/admin/referrals"
                icon={<Share2 className="size-4" />}
                title="Referrals"
                sub={`${stats.activeReferrals} pending`}
              />
              <QuickLink
                href="/admin/audit-log"
                icon={<ScrollText className="size-4" />}
                title="Audit log"
                sub="Full history"
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

// ---------- Building blocks ---------------------------------------------

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

function AttentionRow({
  href,
  icon,
  iconClass,
  title,
  sub,
  count,
  muted = false,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  sub: string;
  count: number;
  muted?: boolean;
}) {
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <Link
        href={href as never}
        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md ring-1",
              iconClass,
              muted && "opacity-60",
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        </div>
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums tracking-tight",
            muted && "text-muted-foreground/60",
          )}
        >
          {count}
        </span>
      </Link>
    </li>
  );
}

function DistLegend({
  color,
  label,
  value,
  pct,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", color)} aria-hidden />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <p className="mt-0.5 tabular-nums">
        <span className="font-medium text-foreground">{value}</span>
        <span className="ml-1 text-muted-foreground">
          {pct.toFixed(0)}%
        </span>
      </p>
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

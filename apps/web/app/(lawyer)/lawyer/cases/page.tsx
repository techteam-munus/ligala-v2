import Link from "next/link";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CaseStatusPill,
  CaseTypePill,
  type CaseStatus,
} from "@/app/_components/case-status";

type CaseRow = {
  id: string;
  title: string;
  description: string;
  type: "paid" | "probono";
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  closedAt: string | null;
  counterparty: { name: string; email: string } | null;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

type FilterKey = "all" | "pending" | "open" | "closed";

const FILTER_TABS: { key: FilterKey; label: string; match: (s: CaseStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "pending", label: "Awaiting", match: (s) => s === "pending" },
  {
    key: "open",
    label: "Open",
    match: (s) => s === "accepted" || s === "active",
  },
  {
    key: "closed",
    label: "Closed",
    match: (s) => s === "closed" || s === "cancelled" || s === "declined",
  },
];

export default async function LawyerCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tab: FilterKey = (Array.isArray(raw) ? raw[0] : raw) as FilterKey;
  const activeTab: FilterKey = ["all", "pending", "open", "closed"].includes(tab)
    ? tab
    : "all";

  const { items } = await safe<{ items: CaseRow[] }>("/cases", { items: [] });

  const counts = {
    pending: items.filter((c) => c.status === "pending").length,
    open: items.filter((c) => c.status === "accepted" || c.status === "active")
      .length,
    closed: items.filter(
      (c) =>
        c.status === "closed" ||
        c.status === "cancelled" ||
        c.status === "declined",
    ).length,
    probono: items.filter((c) => c.type === "probono").length,
  };

  const activeMatcher =
    FILTER_TABS.find((t) => t.key === activeTab)?.match ?? (() => true);
  const filtered = items.filter((c) => activeMatcher(c.status));

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Header --------------------------------------------------------- */}
      <header className="border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Lawyer · Pipeline
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Cases</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {items.length === 0
            ? "Nothing here yet. Cases land here when clients submit to your profile."
            : `${items.length} total · ${counts.pending} awaiting decision · ${counts.open} open`}
        </p>
      </header>

      {/* KPI strip ------------------------------------------------------ */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Awaiting"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={<span className="tabular-nums">{counts.pending}</span>}
          secondary={
            counts.pending === 0 ? "Inbox clear" : "Need your decision"
          }
          muted={counts.pending === 0}
        />
        <KpiCard
          label="Open"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<span className="tabular-nums">{counts.open}</span>}
          secondary={
            counts.open === 0 ? "Nothing in progress" : "Accepted + active"
          }
          muted={counts.open === 0}
        />
        <KpiCard
          label="Closed"
          accent="bg-zinc-400"
          accentRing="ring-zinc-200/60 dark:ring-zinc-700/40"
          primary={<span className="tabular-nums">{counts.closed}</span>}
          secondary="Lifetime"
          muted={counts.closed === 0}
        />
        <KpiCard
          label="Pro bono"
          accent="bg-violet-500"
          accentRing="ring-violet-200/60 dark:ring-violet-900/30"
          primary={<span className="tabular-nums">{counts.probono}</span>}
          secondary={
            items.length > 0
              ? `${((counts.probono / items.length) * 100).toFixed(0)}% of cases`
              : "—"
          }
          muted={counts.probono === 0}
        />
      </section>

      {/* Filter tabs ---------------------------------------------------- */}
      <nav
        className="mt-6 inline-flex w-fit items-center rounded-full border border-border/60 bg-card p-1"
        aria-label="Filter cases by status"
      >
        {FILTER_TABS.map((t) => {
          const isActive = t.key === activeTab;
          const count =
            t.key === "all"
              ? items.length
              : t.key === "pending"
                ? counts.pending
                : t.key === "open"
                  ? counts.open
                  : counts.closed;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/lawyer/cases" : `/lawyer/cases?tab=${t.key}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "tabular-nums",
                  isActive ? "opacity-80" : "text-muted-foreground/70",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Table ---------------------------------------------------------- */}
      <Card className="mt-4 gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Case
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Client
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Created
                </TableHead>
                <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Updated
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Briefcase className="size-5" />
                        </span>
                        <p className="font-medium">No cases yet</p>
                        <p className="text-xs">
                          New requests will show up here as clients submit to
                          your public profile.
                        </p>
                      </div>
                    ) : (
                      "No cases in this view."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className={cn(
                      "group transition-colors",
                      c.status === "pending" &&
                        "shadow-[inset_2px_0_0_0_#f59e0b]",
                    )}
                  >
                    <TableCell className="pl-4 py-3">
                      <CaseStatusPill status={c.status} />
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <Link
                        href={`/lawyer/cases/${c.id}` as never}
                        className="font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {c.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      {c.counterparty ? (
                        <>
                          <div className="font-medium">
                            {c.counterparty.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.counterparty.email}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <CaseTypePill kind={c.type} />
                    </TableCell>
                    <TableCell className="py-3 text-sm tabular-nums text-muted-foreground">
                      {shortDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="pr-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2 text-sm tabular-nums text-muted-foreground group-hover:text-foreground">
                        {shortDate(c.updatedAt)}
                        <ArrowUpRight className="size-3.5 opacity-60" />
                      </div>
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

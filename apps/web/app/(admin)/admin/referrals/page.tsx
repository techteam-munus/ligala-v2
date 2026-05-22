import { Briefcase, Link2, Share2 } from "lucide-react";
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
import { PageHero } from "@/app/_components/page-hero";

type Referral = {
  id: string;
  kind: "case_referral" | "link_signup";
  fromLawyerId: string;
  toLawyerId: string;
  status: "pending" | "accepted" | "declined" | "completed";
  caseId: string | null;
  linkId: string | null;
  createdAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

const STATUS_STYLE: Record<
  Referral["status"],
  { label: string; dot: string; text: string; ring: string }
> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/60 dark:ring-amber-900/40",
  },
  accepted: {
    label: "Accepted",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200/60 dark:ring-sky-900/40",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
  },
  declined: {
    label: "Declined",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200/60 dark:ring-rose-900/40",
  },
};

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

export default async function AdminReferralsPage() {
  const { items } = await safe<{ items: Referral[] }>("/admin/referrals", {
    items: [],
  });

  const pending = items.filter((r) => r.status === "pending").length;
  const accepted = items.filter((r) => r.status === "accepted").length;
  const completed = items.filter((r) => r.status === "completed").length;
  const declined = items.filter((r) => r.status === "declined").length;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Admin · Network"
        title="Referrals"
        summary={
          items.length === 0
            ? "No referrals on the platform yet."
            : `Read-only graph (most recent ${items.length}). Force re-decisions live on the referral or case detail pages.`
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pending"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          value={pending}
          subtext="Awaiting decision"
          muted={pending === 0}
        />
        <KpiCard
          label="Accepted"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          value={accepted}
          subtext="In progress"
          muted={accepted === 0}
        />
        <KpiCard
          label="Completed"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          value={completed}
          subtext="Closed referrals"
          muted={completed === 0}
        />
        <KpiCard
          label="Declined"
          accent="bg-rose-500"
          accentRing="ring-rose-200/60 dark:ring-rose-900/30"
          value={declined}
          subtext="Lifetime"
          muted={declined === 0}
        />
      </section>

      <Card className="mt-6 gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Share2 className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Recent referrals
            </p>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </div>
        </div>
        <CardContent className="px-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Share2 className="size-5" />
              </span>
              <p className="text-sm font-medium">No referrals yet</p>
              <p className="text-xs text-muted-foreground">
                When lawyers refer each other or links convert, the graph
                appears here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Kind
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    From → To
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Case
                  </TableHead>
                  <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const style = STATUS_STYLE[r.status];
                  return (
                    <TableRow
                      key={r.id}
                      className={cn(
                        "group transition-colors",
                        r.status === "pending" &&
                          "shadow-[inset_2px_0_0_0_#f59e0b]",
                      )}
                    >
                      <TableCell className="pl-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset",
                            style.text,
                            style.ring,
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              style.dot,
                            )}
                            aria-hidden
                          />
                          {style.label}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          {r.kind === "case_referral" ? (
                            <Briefcase className="size-3 text-muted-foreground" />
                          ) : (
                            <Link2 className="size-3 text-muted-foreground" />
                          )}
                          <span className="capitalize">
                            {r.kind.replace("_", " ")}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="py-3 font-mono text-xs">
                        <span className="text-muted-foreground/80">
                          {r.fromLawyerId.slice(0, 6)}…
                        </span>
                        <span className="mx-1.5 text-muted-foreground/40">
                          →
                        </span>
                        <span className="text-muted-foreground/80">
                          {r.toLawyerId.slice(0, 6)}…
                        </span>
                      </TableCell>
                      <TableCell className="py-3 font-mono text-xs text-muted-foreground/80">
                        {r.caseId ? `${r.caseId.slice(0, 8)}…` : "—"}
                      </TableCell>
                      <TableCell className="pr-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                        {shortDate(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function KpiCard({
  label,
  accent,
  accentRing,
  value,
  subtext,
  muted = false,
}: {
  label: string;
  accent: string;
  accentRing: string;
  value: number;
  subtext: string;
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
            "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
            muted && "text-muted-foreground",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

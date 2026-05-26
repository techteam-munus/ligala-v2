"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowUpRight, Briefcase, Link2 } from "lucide-react";
import { decideOnReferral } from "@/lib/actions/referral";
import { cn } from "@/lib/utils";
import { phDateFormat } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Referral = {
  id: string;
  kind: "case_referral" | "link_signup";
  fromLawyerId: string;
  toLawyerId: string;
  caseId: string | null;
  linkId: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  noteMd: string | null;
  declineReason: string | null;
  decidedAt: string | null;
  createdAt: string;
};

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
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

const STATUS_STYLE: Record<
  Referral["status"],
  { dot: string; text: string }
> = {
  pending: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  accepted: {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
  },
  declined: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
  completed: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

export function ReferralsList({
  items,
  side,
  meId,
}: {
  items: Referral[];
  side: "inbound" | "outbound";
  meId: string;
}) {
  return (
    <ul className="divide-y divide-border/60">
      {items.map((r) => (
        <Row key={r.id} r={r} side={side} meId={meId} />
      ))}
    </ul>
  );
}

function Row({
  r,
  side,
  meId,
}: {
  r: Referral;
  side: "inbound" | "outbound";
  meId: string;
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canDecide =
    side === "inbound" &&
    r.status === "pending" &&
    r.kind === "case_referral" &&
    r.toLawyerId === meId;

  function decide(decision: "accept" | "decline") {
    setError(null);
    start(async () => {
      try {
        await decideOnReferral(r.id, {
          decision,
          reason: reason || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const style = STATUS_STYLE[r.status];
  const kindIcon =
    r.kind === "case_referral" ? (
      <Briefcase className="size-3.5" />
    ) : (
      <Link2 className="size-3.5" />
    );
  const kindLabel = r.kind === "case_referral" ? "Case referral" : "Link signup";

  return (
    <li
      className={cn(
        "px-4 py-3 transition-colors",
        r.status === "pending" && side === "inbound" &&
          "shadow-[inset_2px_0_0_0_#f59e0b]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border/60",
            )}
          >
            {kindIcon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{kindLabel}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset ring-border/60",
                  style.text,
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", style.dot)}
                  aria-hidden
                />
                {r.status}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              <span suppressHydrationWarning>{relativeTime(r.createdAt)}</span>
            </p>
          </div>
        </div>
        {r.caseId ? (
          <Button asChild variant="ghost" size="xs">
            <Link href={`/lawyer/cases/${r.caseId}` as never}>
              Open case
              <ArrowUpRight />
            </Link>
          </Button>
        ) : null}
      </div>
      {r.noteMd ? (
        <p className="mt-2 whitespace-pre-line rounded-md bg-muted/30 px-3 py-2 text-sm">
          {r.noteMd}
        </p>
      ) : null}
      {r.declineReason ? (
        <p className="mt-2 rounded-md border border-rose-200/60 bg-rose-50/40 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          Declined: {r.declineReason}
        </p>
      ) : null}
      {canDecide ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Decline reason (optional)"
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => decide("accept")}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => decide("decline")}
            >
              Decline
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </li>
  );
}

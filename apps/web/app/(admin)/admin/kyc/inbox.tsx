"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideOnKyc } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import { phDateFormat } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  submission: {
    id: string;
    lawyerId: string;
    status: string;
    createdAt: string;
  };
  lawyerEmail: string;
  lawyerName: string;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function tintFor(id: string): { bg: string; text: string; ring: string } {
  const palette = [
    {
      bg: "bg-sky-500/15",
      text: "text-sky-700 dark:text-sky-300",
      ring: "ring-sky-200/60 dark:ring-sky-900/40",
    },
    {
      bg: "bg-emerald-500/15",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
    },
    {
      bg: "bg-violet-500/15",
      text: "text-violet-700 dark:text-violet-300",
      ring: "ring-violet-200/60 dark:ring-violet-900/40",
    },
    {
      bg: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-200/60 dark:ring-amber-900/40",
    },
    {
      bg: "bg-rose-500/15",
      text: "text-rose-700 dark:text-rose-300",
      ring: "ring-rose-200/60 dark:ring-rose-900/40",
    },
  ] as const;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length]!;
}

function longDate(iso: string) {
  return phDateFormat({
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function KycInbox({ items }: { items: Row[] }) {
  return (
    <ul className="divide-y divide-border/60">
      {items.map((r) => (
        <Item key={r.submission.id} row={r} />
      ))}
    </ul>
  );
}

function Item({ row }: { row: Row }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const tint = tintFor(row.submission.lawyerId);

  function decide(decision: "approve" | "reject") {
    if (decision === "reject" && reason.trim().length < 3) {
      setErr("Reason required (min 3 chars) for rejection.");
      return;
    }
    setErr(null);
    start(async () => {
      try {
        await decideOnKyc(row.submission.id, {
          decision,
          reason: reason || undefined,
        });
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <li className="px-4 py-4 shadow-[inset_2px_0_0_0_#f59e0b]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset",
              tint.bg,
              tint.text,
              tint.ring,
            )}
            aria-hidden
          >
            {initialsOf(row.lawyerName) || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.lawyerName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.lawyerEmail}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              Submitted{" "}
              <span suppressHydrationWarning>
                {relativeTime(row.submission.createdAt)}
              </span>
              <span className="ml-1 text-muted-foreground/60">
                · {longDate(row.submission.createdAt)}
              </span>
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason · required for reject"
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => decide("approve")}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check />
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || reason.trim().length < 3}
            onClick={() => decide("reject")}
            className="border-rose-300/60 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            <X />
            Reject
          </Button>
        </div>
      </div>
      {err ? (
        <p className="mt-2 text-xs text-destructive">{err}</p>
      ) : null}
    </li>
  );
}

"use client";

import { useState, useTransition } from "react";
import { TicketPercent, Trash2, UserCog } from "lucide-react";
import { deleteDiscountCode } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import { phDateFormat } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

type Row = {
  code: {
    id: string;
    code: string;
    kind: "percent" | "fixed";
    valueBps: number | null;
    valueCents: number | null;
    redemptions: number;
    maxRedemptions: number | null;
    validUntil: string | null;
  };
  lawyerEmail: string;
  lawyerName: string;
  lawyerRole: "client" | "lawyer" | "admin";
};

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function shortDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return phDateFormat({
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

export function CodesList({ items }: { items: Row[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function remove(row: Row) {
    const reason = window.prompt(`Reason to remove ${row.code.code}?`)?.trim();
    if (!reason || reason.length < 3) return;
    setErr(null);
    start(async () => {
      try {
        await deleteDiscountCode(row.code.id, reason);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <TicketPercent className="size-5" />
        </span>
        <p className="text-sm font-medium">No discount codes yet</p>
        <p className="text-xs text-muted-foreground">
          Mint the first subscription code from the panel on the right.
        </p>
      </div>
    );
  }

  return (
    <>
      {err ? (
        <p className="border-b border-border/60 px-4 py-2 text-xs text-destructive">
          {err}
        </p>
      ) : null}
      <ul className="divide-y divide-border/60">
        {items.map((r) => {
          const expired =
            r.code.validUntil &&
            new Date(r.code.validUntil).getTime() < Date.now();
          const exhausted =
            r.code.maxRedemptions != null &&
            r.code.redemptions >= r.code.maxRedemptions;
          const inactive = expired || exhausted;
          const isAdmin = r.lawyerRole === "admin";

          return (
            <li
              key={r.code.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 px-4 py-3",
                inactive && "opacity-70",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium tracking-tight">
                    {r.code.code}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[10px] font-medium tabular-nums">
                    {r.code.kind === "percent"
                      ? `${((r.code.valueBps ?? 0) / 100).toFixed(0)}% off`
                      : `₱${pesoNumber(r.code.valueCents ?? 0)} off`}
                  </span>
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-inset ring-violet-200/60 dark:text-violet-300 dark:ring-violet-900/40">
                      <UserCog className="size-3" />
                      Subscription
                    </span>
                  ) : null}
                  {expired ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                      expired
                    </span>
                  ) : null}
                  {exhausted ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                      exhausted
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isAdmin ? (
                    <span>Admin-owned · lawyer subscriptions</span>
                  ) : (
                    <span>
                      By <span className="text-foreground">{r.lawyerName}</span>{" "}
                      <span className="text-muted-foreground/60">
                        · {r.lawyerEmail}
                      </span>
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {r.code.redemptions}
                  </span>
                  {r.code.maxRedemptions != null ? (
                    <span> / {r.code.maxRedemptions}</span>
                  ) : null}{" "}
                  redemption{r.code.redemptions === 1 ? "" : "s"}
                  {r.code.validUntil ? (
                    <span className="text-muted-foreground/60">
                      {" · valid until "}
                      {shortDate(r.code.validUntil)}
                    </span>
                  ) : null}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => remove(r)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${r.code.code}`}
              >
                <Trash2 />
                Remove
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

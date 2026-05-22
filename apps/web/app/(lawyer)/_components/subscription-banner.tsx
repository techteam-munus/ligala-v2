import Link from "next/link";
import { ArrowUpRight, Clock, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SubscriptionDto = {
  status: "trialing" | "active" | "past_due";
  currentPeriodEndsAt: string;
  daysRemaining: number;
};

/**
 * Fetched per-render via Server Component. If the API call fails (dev API
 * down, infra hiccup, lawyer somehow has no subscription row), we render
 * nothing rather than nuking the lawyer portal layout.
 */
async function loadSubscription(): Promise<SubscriptionDto | null> {
  try {
    const res = await api<{ subscription: SubscriptionDto }>(
      "/lawyer/subscription",
    );
    return res.subscription;
  } catch {
    return null;
  }
}

export async function SubscriptionBanner() {
  const sub = await loadSubscription();
  if (!sub) return null;
  if (sub.status === "active" && sub.daysRemaining > 7) return null;

  const expired = sub.daysRemaining < 0;
  const urgent = expired || sub.daysRemaining <= 3;

  const accent = expired
    ? "bg-rose-500"
    : urgent
      ? "bg-amber-500"
      : "bg-sky-500";
  const containerTone = expired
    ? "bg-rose-50/40 dark:bg-rose-950/15"
    : urgent
      ? "bg-amber-50/40 dark:bg-amber-950/15"
      : "bg-muted/30";
  const labelTone = expired
    ? "text-rose-700 dark:text-rose-300"
    : urgent
      ? "text-amber-700 dark:text-amber-300"
      : "text-sky-700 dark:text-sky-300";

  const icon = expired ? (
    <TriangleAlert className="size-3.5" />
  ) : (
    <Clock className="size-3.5" />
  );

  const message = expired
    ? "Your trial has ended. Subscribe to keep creating cases and sending invoices."
    : sub.status === "trialing"
      ? `${sub.daysRemaining} day${sub.daysRemaining === 1 ? "" : "s"} left in your free trial.`
      : `Subscription renews in ${sub.daysRemaining} day${sub.daysRemaining === 1 ? "" : "s"}.`;

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-2.5 text-sm",
        containerTone,
      )}
    >
      <span
        className={cn("absolute left-0 inset-y-2 w-[2px] rounded-r-full", accent)}
        aria-hidden
      />
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("inline-flex items-center gap-1.5", labelTone)}>
          {icon}
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            {expired ? "Action required" : "Heads up"}
          </span>
        </span>
        <span className="text-foreground/90">{message}</span>
      </div>
      <Link
        href="/lawyer/subscribe"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/60",
        )}
      >
        {expired ? "Subscribe now" : "Manage"}
        <ArrowUpRight className="size-3 opacity-60" />
      </Link>
    </div>
  );
}

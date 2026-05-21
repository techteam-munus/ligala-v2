import Link from "next/link";
import { api } from "@/lib/api";

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
  // amber when ≤7 days remain (trial or paid period nearing end); red when
  // already past; muted otherwise.
  const tone = expired
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : sub.daysRemaining <= 7
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-border bg-muted text-muted-foreground";

  const message = expired
    ? "Your trial has ended. Subscribe to keep creating cases and sending invoices."
    : sub.status === "trialing"
      ? `${sub.daysRemaining} day${sub.daysRemaining === 1 ? "" : "s"} left in your free trial.`
      : `Subscription renews in ${sub.daysRemaining} day${sub.daysRemaining === 1 ? "" : "s"}.`;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm ${tone}`}
    >
      <span>{message}</span>
      <Link
        href="/lawyer/subscribe"
        className="font-medium underline-offset-2 hover:underline"
      >
        {expired ? "Subscribe now →" : "Manage subscription →"}
      </Link>
    </div>
  );
}

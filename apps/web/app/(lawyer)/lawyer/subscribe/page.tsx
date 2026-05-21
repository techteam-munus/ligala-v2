import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscribeButton } from "./subscribe-button";

type SubscriptionDto = {
  lawyerId: string;
  status: "trialing" | "active" | "past_due";
  trialEndsAt: string;
  currentPeriodEndsAt: string;
  lastPaidAt: string | null;
  priceCents: number;
  daysRemaining: number;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subscription } = await api<{ subscription: SubscriptionDto }>(
    "/lawyer/subscription",
  );
  const expired = subscription.daysRemaining < 0;
  const price = money(subscription.priceCents);
  const sp = await searchParams;
  const arrivedFromBlock = sp.from === "expired";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Subscription</h1>
      <p className="mt-2 text-muted-foreground">
        {arrivedFromBlock
          ? "We couldn’t complete that action because your subscription has lapsed. Subscribe to continue."
          : subscription.status === "trialing"
            ? "You’re on a free trial of Ligala for lawyers."
            : subscription.status === "active"
              ? "Your Ligala subscription is active."
              : "Your subscription has lapsed."}
      </p>

      <Card className="mt-8 gap-3 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-xl">
            {price}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / month
            </span>
          </CardTitle>
          <CardDescription>
            {expired ? (
              <>
                Your access lapsed on{" "}
                <strong>{formatDate(subscription.currentPeriodEndsAt)}</strong>.
                Subscribe to resume creating cases, sending invoices, and the
                rest.
              </>
            ) : subscription.status === "trialing" ? (
              <>
                {subscription.daysRemaining} day
                {subscription.daysRemaining === 1 ? "" : "s"} left in trial —
                ends {formatDate(subscription.currentPeriodEndsAt)}.
              </>
            ) : (
              <>
                Renews on{" "}
                <strong>{formatDate(subscription.currentPeriodEndsAt)}</strong>.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <SubscribeButton
            label={
              expired
                ? `Subscribe (${price} / mo)`
                : subscription.status === "trialing"
                  ? `Subscribe now (${price} / mo)`
                  : `Renew early (${price} / mo)`
            }
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Each payment extends your access by 30 days. No auto-renewal — pay
            again when you&apos;re ready.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

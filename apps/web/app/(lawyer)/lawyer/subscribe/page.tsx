import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
import { SubscribeButton } from "./subscribe-button";
import { PaymentStatusBanner } from "./_components/payment-status-banner";

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
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function longDate(iso: string) {
  return phDateFormat({
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_META: Record<
  "trialing" | "active" | "past_due" | "expired",
  { label: string; dot: string; text: string }
> = {
  trialing: {
    label: "Trial",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
  },
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  past_due: {
    label: "Past due",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
  expired: {
    label: "Lapsed",
    dot: "bg-zinc-400",
    text: "text-muted-foreground",
  },
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subscription } = await api<{ subscription: SubscriptionDto }>(
    "/lawyer/subscription",
  );
  const expired = subscription.daysRemaining < 0;
  const sp = await searchParams;
  const arrivedFromBlock = sp.from === "expired" && sp.status !== "success";
  const status =
    sp.status === "success" || sp.status === "cancelled" ? sp.status : null;

  const stateKey: keyof typeof STATUS_META = expired
    ? "expired"
    : subscription.status;
  const meta = STATUS_META[stateKey];

  const summary = arrivedFromBlock
    ? "We couldn't complete that action because your subscription has lapsed. Subscribe to continue."
    : subscription.status === "trialing"
      ? "You're on a free trial of Ligala for lawyers."
      : subscription.status === "active"
        ? "Your Ligala subscription is active."
        : "Your subscription has lapsed.";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Subscription"
        title="Subscription"
        summary={summary}
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-inset ring-border/60",
              meta.text,
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", meta.dot)}
              aria-hidden
            />
            {meta.label}
          </span>
        }
      />

      {status ? (
        <div className="mt-6">
          <PaymentStatusBanner
            status={status}
            initialLastPaidAt={subscription.lastPaidAt}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Plan card =================================================== */}
        <Card className="gap-0 py-0 overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
            <div className="flex items-baseline gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Ligala for Lawyers
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <p className="text-5xl font-semibold tracking-tight">
                <span className="text-muted-foreground/70 text-2xl align-top mr-0.5">
                  ₱
                </span>
                <span className="tabular-nums">
                  {pesoNumber(subscription.priceCents)}
                </span>
              </p>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {expired ? (
                <>
                  Access lapsed on{" "}
                  <strong className="text-foreground">
                    {longDate(subscription.currentPeriodEndsAt)}
                  </strong>
                  . Subscribe to resume.
                </>
              ) : subscription.status === "trialing" ? (
                <>
                  {subscription.daysRemaining} day
                  {subscription.daysRemaining === 1 ? "" : "s"} left in trial —
                  ends{" "}
                  <strong className="text-foreground">
                    {longDate(subscription.currentPeriodEndsAt)}
                  </strong>
                  .
                </>
              ) : (
                <>
                  Renews on{" "}
                  <strong className="text-foreground">
                    {longDate(subscription.currentPeriodEndsAt)}
                  </strong>
                  .
                </>
              )}
            </p>
          </div>

          <CardContent className="px-5 py-5 space-y-5">
            <ul className="space-y-2.5">
              <Feature label="Unlimited active cases and clients" />
              <Feature label="Invoicing with PayMongo + PayPal checkout" />
              <Feature label="Discount codes in your own namespace" />
              <Feature label="Referral links with click + signup attribution" />
              <Feature label="KYC verification badge on your public profile" />
            </ul>

            <div className="border-t border-border/60 pt-5">
              <SubscribeButton
                actionLabel={
                  expired
                    ? "Subscribe"
                    : subscription.status === "trialing"
                      ? "Subscribe now"
                      : "Renew early"
                }
                priceCents={subscription.priceCents}
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Each payment extends your access by 30 days. No auto-renewal — pay
              again when you&apos;re ready.
            </p>
          </CardContent>
        </Card>

        {/* Status rail ================================================ */}
        <aside className="space-y-4 lg:self-start">
          <Card size="sm" className="gap-3">
            <CardHeader className="flex-row items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Your status
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Days remaining
                </p>
                <p
                  className={cn(
                    "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
                    expired && "text-rose-600",
                  )}
                >
                  {expired ? "—" : subscription.daysRemaining}
                </p>
                <p className="text-xs text-muted-foreground">
                  Until{" "}
                  {subscription.status === "trialing"
                    ? "trial ends"
                    : "current period ends"}
                </p>
              </div>

              <dl className="space-y-2 border-t border-border/60 pt-3 text-xs">
                <MetaRow
                  icon={<Calendar className="size-3.5" />}
                  label="Current period ends"
                  value={longDate(subscription.currentPeriodEndsAt)}
                />
                {subscription.lastPaidAt ? (
                  <MetaRow
                    icon={<CheckCircle2 className="size-3.5" />}
                    label="Last paid"
                    value={longDate(subscription.lastPaidAt)}
                  />
                ) : (
                  <MetaRow
                    icon={<Sparkles className="size-3.5" />}
                    label="Last paid"
                    value="—"
                  />
                )}
                <MetaRow
                  icon={<CreditCard className="size-3.5" />}
                  label="Plan"
                  value={money(subscription.priceCents) + " / mo"}
                />
              </dl>
            </CardContent>
          </Card>

          <Card size="sm" className="gap-2 bg-muted/20">
            <CardContent>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <ShieldCheck className="mr-1 inline size-3" />
                Payment security
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We never see your card. PayMongo handles card, GCash, Maya, and
                GrabPay. Webhooks are signed and verified.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>{label}</span>
    </li>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </dt>
      <dd className="text-right text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

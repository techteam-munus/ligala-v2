import { headers } from "next/headers";
import { Link2, MousePointerClick, UserPlus2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
import { LinksManager } from "./manager";

type Link = {
  id: string;
  slug: string;
  label: string | null;
  active: boolean;
  clicks: number;
  signups: number;
  createdAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function ReferralLinksPage() {
  const { items } = await safe<{ items: Link[] }>("/referrals/links", {
    items: [],
  });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const totalClicks = items.reduce((s, l) => s + l.clicks, 0);
  const totalSignups = items.reduce((s, l) => s + l.signups, 0);
  const conversionPct =
    totalClicks > 0 ? (totalSignups / totalClicks) * 100 : 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Growth"
        title="Referral links"
        summary="Share these on social, email, or your own site. Anyone who starts a case via the link gets attributed to you in the referrals dashboard."
      />

      {/* KPI strip */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Links"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          primary={
            <span className="inline-flex items-center gap-2 tabular-nums">
              <Link2 className="size-5 text-muted-foreground/70" />
              {items.length}
            </span>
          }
          secondary={
            items.length === 0
              ? "Create one to start tracking"
              : `${items.filter((l) => l.active).length} active`
          }
          muted={items.length === 0}
        />
        <KpiCard
          label="Clicks"
          accent="bg-violet-500"
          accentRing="ring-violet-200/60 dark:ring-violet-900/30"
          primary={
            <span className="inline-flex items-center gap-2 tabular-nums">
              <MousePointerClick className="size-5 text-muted-foreground/70" />
              {totalClicks.toLocaleString("en-PH")}
            </span>
          }
          secondary="Lifetime"
          muted={totalClicks === 0}
        />
        <KpiCard
          label="Signups"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={
            <span className="inline-flex items-center gap-2 tabular-nums">
              <UserPlus2 className="size-5 text-muted-foreground/70" />
              {totalSignups.toLocaleString("en-PH")}
            </span>
          }
          secondary={
            totalClicks > 0
              ? `${conversionPct.toFixed(1)}% click-to-signup`
              : "Lifetime"
          }
          muted={totalSignups === 0}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        <LinksManager items={items} origin={origin} />
      </div>
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

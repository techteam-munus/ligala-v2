import { TicketPercent } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
import { CodesList } from "./list";
import { CreateDiscountCodeForm } from "./create-form";

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

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function AdminDiscountCodesPage() {
  const { items } = await safe<{ items: Row[] }>("/admin/discount-codes", {
    items: [],
  });

  const totalRedemptions = items.reduce((s, c) => s + c.code.redemptions, 0);
  const adminCodes = items.filter((c) => c.lawyerRole === "admin").length;
  const lawyerCodes = items.length - adminCodes;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Admin · Billing"
        title="Discount codes"
        summary="Mint admin-owned codes for lawyer subscription billing, and moderate every active code across the platform."
      />

      {/* KPI strip ---------------------------------------------------- */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="All codes"
          accent="bg-foreground/80"
          accentRing="ring-foreground/10"
          value={items.length}
          subtext="Across the platform"
          muted={items.length === 0}
        />
        <KpiCard
          label="Subscription"
          accent="bg-violet-500"
          accentRing="ring-violet-200/60 dark:ring-violet-900/30"
          value={adminCodes}
          subtext="Admin-owned · for lawyer subs"
          muted={adminCodes === 0}
        />
        <KpiCard
          label="Lawyer-owned"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          value={lawyerCodes}
          subtext="Per-lawyer namespaces"
          muted={lawyerCodes === 0}
        />
        <KpiCard
          label="Redemptions"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          value={totalRedemptions}
          subtext="Lifetime"
          muted={totalRedemptions === 0}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        {/* List ----------------------------------------------------- */}
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <TicketPercent className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                All codes
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
          </div>
          <CardContent className="px-0">
            <CodesList items={items} />
          </CardContent>
        </Card>

        {/* Create form --------------------------------------------- */}
        <aside>
          <CreateDiscountCodeForm />
        </aside>
      </div>
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
          {value.toLocaleString("en-PH")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

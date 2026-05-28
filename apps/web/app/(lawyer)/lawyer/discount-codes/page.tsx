import { TicketPercent } from "lucide-react";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
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
import { DiscountCodesForm } from "./form";

type Code = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  valueBps: number | null;
  valueCents: number | null;
  redemptions: number;
  maxRedemptions: number | null;
  validUntil: string | null;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
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

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function DiscountCodesPage() {
  const { items } = await safe<{ items: Code[] }>("/billing/discount-codes", {
    items: [],
  });

  const now = Date.now();
  const totalRedemptions = items.reduce((s, c) => s + c.redemptions, 0);
  const active = items.filter((c) => {
    if (c.validUntil && new Date(c.validUntil).getTime() < now) return false;
    if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) {
      return false;
    }
    return true;
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Billing"
        title="Discount codes"
        summary="Codes you mint live in your namespace — clients apply them at checkout on invoices you've issued."
      />

      {/* KPI strip */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Codes"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          primary={<span className="tabular-nums">{items.length}</span>}
          secondary={items.length === 0 ? "None yet" : "In your namespace"}
          muted={items.length === 0}
        />
        <KpiCard
          label="Redemptions"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<span className="tabular-nums">{totalRedemptions}</span>}
          secondary="Across all codes"
          muted={totalRedemptions === 0}
        />
        <KpiCard
          label="Active now"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={<span className="tabular-nums">{active.length}</span>}
          secondary="Within limit, not expired"
          muted={active.length === 0}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
        {/* Codes table -------------------------------------------- */}
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <TicketPercent className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Your codes
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
          </div>
          <CardContent className="px-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <TicketPercent className="size-5" />
                </span>
                <p className="text-sm font-medium">No codes yet</p>
                <p className="text-xs text-muted-foreground">
                  Mint your first code from the panel on the right.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Code
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Value
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Redemptions
                    </TableHead>
                    <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Valid until
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => {
                    const expired =
                      c.validUntil &&
                      new Date(c.validUntil).getTime() < now;
                    const exhausted =
                      c.maxRedemptions != null &&
                      c.redemptions >= c.maxRedemptions;
                    const inactive = expired || exhausted;
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(
                          inactive && "text-muted-foreground/70",
                        )}
                      >
                        <TableCell className="pl-4 py-3">
                          <span className="font-mono text-sm font-medium tracking-tight">
                            {c.code}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm tabular-nums">
                          {c.kind === "percent"
                            ? `${((c.valueBps ?? 0) / 100).toFixed(0)}% off`
                            : `₱${pesoNumber(c.valueCents ?? 0)} off`}
                        </TableCell>
                        <TableCell className="py-3 text-sm tabular-nums">
                          {c.redemptions}
                          {c.maxRedemptions != null ? (
                            <span className="text-muted-foreground">
                              {" "}
                              / {c.maxRedemptions}
                            </span>
                          ) : null}
                          {exhausted ? (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                              done
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="pr-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                          {shortDate(c.validUntil) ?? "—"}
                          {expired ? (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                              expired
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create form -------------------------------------------- */}
        <aside>
          <DiscountCodesForm />
        </aside>
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

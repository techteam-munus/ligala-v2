// apps/web/app/(admin)/admin/payouts/page.tsx
import Link from "next/link";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PayoutRow = {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "returned";
  provider: string;
  failureReason: string | null;
  requestedAt: string;
  completedAt: string | null;
  destinationSnapshot: { type?: string; accountNumber?: string } | null;
  lawyer: { name: string; email: string } | null;
};

const STATUS_OPTIONS = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "returned",
] as const;

const STATUS_TONE: Record<PayoutRow["status"], string> = {
  pending: "text-amber-700 dark:text-amber-300",
  processing: "text-sky-700 dark:text-sky-300",
  succeeded: "text-emerald-700 dark:text-emerald-300",
  failed: "text-zinc-500",
  returned: "text-rose-700 dark:text-rose-300",
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return phDateFormat({
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

function Peso({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

// Native <select> styled to match shadcn Input so it submits cleanly with the
// surrounding HTML form. Switching to the Radix-based Select would require
// client-side form state.
const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const status = pick("status") ?? "";
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";

  const { items } = await safe<{ items: PayoutRow[] }>(
    `/admin/payouts${queryStr}`,
    { items: [] },
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Header ----------------------------------------------------------- */}
      <header className="border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Admin · Money
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Payouts</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {items.length.toLocaleString("en-PH")} payout
          {items.length === 1 ? "" : "s"} across all lawyers.
        </p>
      </header>

      {/* Filter bar ------------------------------------------------------- */}
      <Card size="sm" className="mt-6 gap-0 py-0">
        <CardContent className="px-2 py-2">
          <form className="flex flex-wrap items-center gap-2">
            <select name="status" defaultValue={status} className={SELECT_CLASS}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit">Filter</Button>
            {status ? (
              <Button asChild variant="ghost">
                <Link href="/admin/payouts">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Table ------------------------------------------------------------ */}
      <Card className="mt-4 gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Requested
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Lawyer
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Destination
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Net
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    {status ? "No payouts match this status." : "No payouts yet."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <TableRow key={p.id} className="hover:bg-transparent">
                    <TableCell className="pl-4 py-3 text-sm tabular-nums text-muted-foreground">
                      {shortDate(p.requestedAt)}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <div className="font-medium">{p.lawyer?.name ?? "—"}</div>
                      {p.lawyer?.email ? (
                        <div className="text-xs text-muted-foreground">
                          {p.lawyer.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <span className="capitalize">
                        {p.destinationSnapshot?.type ?? "—"}
                      </span>
                      {p.destinationSnapshot?.accountNumber ? (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {p.destinationSnapshot.accountNumber}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wider",
                          STATUS_TONE[p.status],
                        )}
                      >
                        {p.status}
                      </span>
                      {p.failureReason ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.failureReason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm">
                      <Peso cents={p.amountCents} className="text-muted-foreground" />
                    </TableCell>
                    <TableCell className="pr-4 py-3 text-right text-sm font-medium">
                      <Peso cents={p.netCents} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

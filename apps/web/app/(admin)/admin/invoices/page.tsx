import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Invoice = {
  id: string;
  number: string;
  status: "draft" | "sent" | "paid" | "partially_paid" | "void";
  currency: string;
  subtotalCents: number;
  totalCents: number;
  paidCents: number;
  caseId: string;
  clientId: string;
  lawyerId: string;
  createdAt: string;
};

type Resp = { items: Invoice[]; total: number; page: number; pageSize: number };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

const SELECT_CLASS =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const q = pick("q") ?? "";
  const status = pick("status") ?? "";
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";

  const resp = await safe<Resp>(`/admin/invoices${queryStr}`, {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
      <p className="mt-2 text-muted-foreground">{resp.total} total. Click a row to view + refund.</p>

      <Card className="mt-6 gap-0 py-3">
        <CardContent className="px-3">
          <form className="flex flex-wrap items-center gap-3">
            <Input
              name="q"
              defaultValue={q}
              placeholder="invoice number"
              className="flex-1 font-mono"
            />
            <select name="status" defaultValue={status} className={SELECT_CLASS}>
              <option value="">All statuses</option>
              {["draft", "sent", "paid", "partially_paid", "void"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          <ul className="divide-y text-sm">
            {resp.items.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-2">
                <div>
                  <Link
                    href={`/admin/invoices/${inv.id}` as never}
                    className="font-mono font-medium hover:underline"
                  >
                    {inv.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    paid {(inv.paidCents / 100).toFixed(2)} / {(inv.totalCents / 100).toFixed(2)}{" "}
                    {inv.currency}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    inv.status === "paid"
                      ? "border-green-600 text-green-700"
                      : inv.status === "void"
                        ? "border-neutral-400 text-muted-foreground"
                        : "border-amber-600 text-amber-700"
                  }
                >
                  {inv.status}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

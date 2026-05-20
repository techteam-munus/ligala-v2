import Link from "next/link";
import { api } from "@/lib/api";

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
      <p className="mt-2 text-neutral-600">{resp.total} total. Click a row to view + refund.</p>

      <form className="mt-6 flex flex-wrap gap-3 rounded border border-neutral-200 p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="invoice number"
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm font-mono"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {["draft", "sent", "paid", "partially_paid", "void"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Filter
        </button>
      </form>

      <ul className="mt-6 divide-y divide-neutral-200 rounded border border-neutral-200 text-sm">
        {resp.items.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <Link
                href={`/admin/invoices/${inv.id}` as never}
                className="font-mono font-medium hover:underline"
              >
                {inv.number}
              </Link>
              <p className="text-xs text-neutral-500">
                paid {(inv.paidCents / 100).toFixed(2)} / {(inv.totalCents / 100).toFixed(2)}{" "}
                {inv.currency}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                inv.status === "paid"
                  ? "border-green-600 text-green-700"
                  : inv.status === "void"
                    ? "border-neutral-400 text-neutral-500"
                    : "border-amber-600 text-amber-700"
              }`}
            >
              {inv.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

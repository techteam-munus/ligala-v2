import Link from "next/link";
import { api } from "@/lib/api";

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  paidCents: number;
  currency: string;
  updatedAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default async function LawyerInvoicesPage() {
  const { items } = await safe<{ items: InvoiceRow[] }>("/billing/invoices", { items: [] });
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
        <Link href="/lawyer/discount-codes" className="text-sm text-neutral-700 underline">
          Discount codes →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-8 rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          No invoices yet. Open a case detail page and create one.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {items.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/lawyer/invoices/${inv.id}` as never}
                className="flex items-center justify-between rounded border border-neutral-200 p-3 hover:border-neutral-400"
              >
                <div>
                  <p className="font-medium">{inv.number}</p>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {inv.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{money(inv.totalCents, inv.currency)}</p>
                  {inv.paidCents > 0 ? (
                    <p className="text-xs text-green-700">
                      Paid {money(inv.paidCents, inv.currency)}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

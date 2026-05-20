import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

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

export default async function ClientInvoicesPage() {
  const { items } = await safe<{ items: InvoiceRow[] }>("/billing/invoices", { items: [] });
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
      {items.length === 0 ? (
        <Card className="mt-8 border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            You have no invoices yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-8 space-y-2">
          {items.map((inv) => (
            <li key={inv.id}>
              <Link href={`/invoices/${inv.id}` as never} className="block">
                <Card className="gap-0 py-3 transition-colors hover:border-foreground/40">
                  <CardContent className="px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{inv.number}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {inv.status}
                        </p>
                      </div>
                      <span className="font-medium">{money(inv.totalCents, inv.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

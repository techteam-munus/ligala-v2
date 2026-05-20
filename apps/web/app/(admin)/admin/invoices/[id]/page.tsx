import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { RefundForm } from "./refund-form";

type Invoice = {
  id: string;
  number: string;
  status: string;
  currency: string;
  totalCents: number;
  paidCents: number;
};

type Payment = {
  id: string;
  provider: string;
  providerPaymentId: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  currency: string;
  createdAt: string;
};

type Tx = {
  id: string;
  kind: string;
  direction: string;
  amountCents: number;
  currency: string;
  note: string | null;
  createdAt: string;
};

type Resp = {
  invoice: Invoice;
  payments: Payment[];
  transactions: Tx[];
};

async function load(id: string): Promise<Resp | null> {
  try {
    return await api<Resp>(`/billing/invoices/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function AdminInvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { invoice, payments, transactions } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-mono text-2xl font-semibold">{invoice.number}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        status: {invoice.status} · {(invoice.paidCents / 100).toFixed(2)} /{" "}
        {(invoice.totalCents / 100).toFixed(2)} {invoice.currency} paid
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Payments ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {payments.map((p) => {
              const remaining = p.amountCents - p.refundedCents;
              return (
                <li key={p.id} className="rounded border border-neutral-200 p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{p.provider}</p>
                      <p className="text-xs text-neutral-500 font-mono">
                        {p.providerPaymentId}
                      </p>
                      <p className="mt-1 text-xs">
                        {(p.amountCents / 100).toFixed(2)} {p.currency} ·{" "}
                        refunded {(p.refundedCents / 100).toFixed(2)} ·{" "}
                        remaining {(remaining / 100).toFixed(2)} · status {p.status}
                      </p>
                    </div>
                  </div>
                  {p.status === "succeeded" && remaining > 0 ? (
                    <RefundForm
                      invoiceId={invoice.id}
                      paymentId={p.id}
                      remainingCents={remaining}
                      currency={p.currency}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Ledger
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded border border-neutral-200 text-sm">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-3 py-2">
              <span>
                {t.kind} ({t.direction})
              </span>
              <span className="font-mono">
                {(t.amountCents / 100).toFixed(2)} {t.currency}
              </span>
              <span className="text-xs text-neutral-500">
                {new Date(t.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

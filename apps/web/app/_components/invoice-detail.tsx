"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  applyDiscount,
  checkoutInvoice,
  sendInvoice,
  voidInvoice,
} from "@/lib/actions/billing";

export type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  notesMd: string | null;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

export type Line = {
  id: string;
  description: string;
  qtyThousandths: number;
  unitAmountCents: number;
  lineTotalCents: number;
};

export type PaymentRow = {
  id: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

export type TxRow = {
  id: string;
  kind: string;
  direction: string;
  amountCents: number;
  currency: string;
  note: string | null;
  createdAt: string;
};

export type AppliedCode = {
  code: string;
  kind: "percent" | "fixed";
  valueBps: number | null;
  valueCents: number | null;
} | null;

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function InvoiceDetail({
  viewerRole,
  invoice,
  lines,
  payments,
  transactions,
  appliedCode,
}: {
  viewerRole: "client" | "lawyer";
  invoice: InvoiceRow;
  lines: Line[];
  payments: PaymentRow[];
  transactions: TxRow[];
  appliedCode: AppliedCode;
}) {
  return (
    <div className="space-y-8">
      <header className="border-b border-neutral-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {invoice.number}
          </h1>
          <StatusChip status={invoice.status} />
        </div>
        {invoice.dueAt ? (
          <p className="mt-2 text-sm text-neutral-500">
            Due {new Date(invoice.dueAt).toLocaleDateString()}
          </p>
        ) : null}
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Line items
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-1">Description</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Unit</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-neutral-200">
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{(l.qtyThousandths / 1000).toFixed(3)}</td>
                <td className="py-2 text-right">{money(l.unitAmountCents, invoice.currency)}</td>
                <td className="py-2 text-right">{money(l.lineTotalCents, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-300 text-sm">
              <td className="py-2 text-right" colSpan={3}>
                Subtotal
              </td>
              <td className="py-2 text-right">{money(invoice.subtotalCents, invoice.currency)}</td>
            </tr>
            {invoice.discountCents > 0 ? (
              <tr>
                <td className="py-1 text-right text-neutral-500" colSpan={3}>
                  Discount{appliedCode ? ` (${appliedCode.code})` : ""}
                </td>
                <td className="py-1 text-right text-neutral-500">
                  −{money(invoice.discountCents, invoice.currency)}
                </td>
              </tr>
            ) : null}
            <tr className="border-t border-neutral-300 text-base font-semibold">
              <td className="py-2 text-right" colSpan={3}>
                Total
              </td>
              <td className="py-2 text-right">{money(invoice.totalCents, invoice.currency)}</td>
            </tr>
            {invoice.paidCents > 0 ? (
              <tr className="text-sm text-green-700">
                <td className="py-1 text-right" colSpan={3}>
                  Paid
                </td>
                <td className="py-1 text-right">{money(invoice.paidCents, invoice.currency)}</td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </section>

      {invoice.notesMd ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Notes
          </h2>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
            {invoice.notesMd}
          </pre>
        </section>
      ) : null}

      {viewerRole === "lawyer" && invoice.status === "draft" ? (
        <LawyerActions invoice={invoice} />
      ) : null}

      {viewerRole === "lawyer" && ["sent", "partially_paid"].includes(invoice.status) ? (
        <VoidSection invoice={invoice} />
      ) : null}

      {["draft", "sent"].includes(invoice.status) ? (
        <DiscountSection invoice={invoice} />
      ) : null}

      {viewerRole === "client" && ["sent", "partially_paid"].includes(invoice.status) ? (
        <PayWidget invoice={invoice} />
      ) : null}

      {payments.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Payments
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded border border-neutral-200 p-2"
              >
                <span>
                  {p.provider} · {p.status}
                </span>
                <span>{money(p.amountCents, p.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {transactions.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Transactions
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded border border-neutral-200 p-2"
              >
                <span>
                  {t.kind} · {t.direction}
                  {t.note ? ` · ${t.note}` : ""}
                </span>
                <span>{money(t.amountCents, t.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {viewerRole === "lawyer" ? (
        <Link href="/lawyer/invoices" className="block text-sm text-neutral-700 underline">
          ← All invoices
        </Link>
      ) : (
        <Link href="/invoices" className="block text-sm text-neutral-700 underline">
          ← All invoices
        </Link>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-green-100 text-green-800"
      : status === "void"
        ? "bg-neutral-200 text-neutral-700"
        : status === "sent" || status === "partially_paid"
          ? "bg-blue-100 text-blue-800"
          : "bg-yellow-100 text-yellow-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function LawyerActions({ invoice }: { invoice: InvoiceRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded border border-blue-300 bg-blue-50 p-4">
      <h2 className="font-medium">Send to client</h2>
      <p className="mt-1 text-sm text-neutral-700">
        Once sent, line items become immutable.
      </p>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending || invoice.totalCents <= 0}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await sendInvoice(invoice.id);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send invoice"}
      </button>
    </section>
  );
}

function VoidSection({ invoice }: { invoice: InvoiceRow }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded border border-neutral-300 p-4">
      <h2 className="font-medium">Void invoice</h2>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="mt-3 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
      />
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending || reason.length < 3}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await voidInvoice(invoice.id, { reason });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="mt-3 rounded border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
      >
        {pending ? "Voiding…" : "Void"}
      </button>
    </section>
  );
}

function DiscountSection({ invoice }: { invoice: InvoiceRow }) {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded border border-neutral-300 p-4">
      <h2 className="font-medium">Apply discount code</h2>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm font-mono uppercase"
        />
        <button
          type="button"
          disabled={pending || code.length < 3}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await applyDiscount(invoice.id, { code });
                setCode("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
          className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

function PayWidget({ invoice }: { invoice: InvoiceRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay(provider: "paymongo" | "paypal" | "dev_simulate") {
    setError(null);
    start(async () => {
      try {
        const res = await checkoutInvoice(invoice.id, { provider });
        // In dev: POST the checkout URL directly (it's the dev simulate
        // endpoint). In prod: window.location.href = res.checkoutUrl to
        // redirect to the provider's hosted page.
        if (provider === "dev_simulate") {
          const r = await fetch(res.checkoutUrl, { method: "POST" });
          if (!r.ok) throw new Error(`simulate ${r.status}`);
          window.location.reload();
        } else {
          window.location.href = res.checkoutUrl;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <section className="rounded border border-green-300 bg-green-50 p-4">
      <h2 className="font-medium">Pay invoice</h2>
      <p className="mt-1 text-sm text-neutral-700">
        Remaining: <strong>{money(invoice.totalCents - invoice.paidCents, invoice.currency)}</strong>
      </p>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => pay("paymongo")}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          PayMongo
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => pay("paypal")}
          className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          PayPal
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => pay("dev_simulate")}
          className="rounded border border-dashed border-neutral-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Dev: simulate
        </button>
      </div>
    </section>
  );
}

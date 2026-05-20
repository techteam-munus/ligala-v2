"use client";

import { useState, useTransition } from "react";
import { refundInvoice } from "@/lib/actions/admin";

export function RefundForm({
  invoiceId,
  paymentId,
  remainingCents,
  currency,
}: {
  invoiceId: string;
  paymentId: string;
  remainingCents: number;
  currency: string;
}) {
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErr("Amount must be > 0");
      return;
    }
    if (cents > remainingCents) {
      setErr(`Max refundable: ${(remainingCents / 100).toFixed(2)} ${currency}`);
      return;
    }
    if (reason.trim().length < 3) {
      setErr("Reason required");
      return;
    }
    start(async () => {
      try {
        await refundInvoice(invoiceId, {
          paymentId,
          amountCents: cents,
          reason,
        });
        setOk("Refunded.");
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-end"
    >
      <label className="text-xs">
        <span className="block uppercase tracking-wide text-neutral-500">Amount {currency}</span>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-32 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs sm:flex-1">
        <span className="block uppercase tracking-wide text-neutral-500">Reason</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer satisfaction"
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-500 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
      >
        {pending ? "Refunding…" : "Refund"}
      </button>
      {err ? <p className="text-xs text-red-700 sm:basis-full">{err}</p> : null}
      {ok ? <p className="text-xs text-green-700 sm:basis-full">{ok}</p> : null}
    </form>
  );
}

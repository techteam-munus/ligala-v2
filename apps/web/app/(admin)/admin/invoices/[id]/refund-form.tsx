"use client";

import { useState, useTransition } from "react";
import { refundInvoice } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      className="mt-3 flex flex-col gap-2 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor="refund-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
          Amount {currency}
        </Label>
        <Input
          id="refund-amount"
          type="number"
          min={0.01}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32"
        />
      </div>
      <div className="space-y-1.5 sm:flex-1">
        <Label htmlFor="refund-reason" className="text-xs uppercase tracking-wide text-muted-foreground">
          Reason
        </Label>
        <Input
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer satisfaction"
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="border-destructive text-destructive hover:text-destructive"
      >
        {pending ? "Refunding…" : "Refund"}
      </Button>
      {err ? <p className="text-xs text-destructive sm:basis-full">{err}</p> : null}
      {ok ? <p className="text-xs text-green-700 sm:basis-full">{ok}</p> : null}
    </form>
  );
}

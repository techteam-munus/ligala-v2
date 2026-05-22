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
  onSuccess,
}: {
  invoiceId: string;
  paymentId: string;
  remainingCents: number;
  currency: string;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErr("Amount must be > 0");
      return;
    }
    if (cents > remainingCents) {
      setErr(
        `Max refundable: ${(remainingCents / 100).toFixed(2)} ${currency}`,
      );
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
        setReason("");
        onSuccess?.();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label
          htmlFor="refund-amount"
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Amount · {currency}
        </Label>
        <Input
          id="refund-amount"
          type="number"
          min={0.01}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tabular-nums"
        />
        <p className="text-[11px] text-muted-foreground">
          Max refundable: {(remainingCents / 100).toFixed(2)} {currency}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="refund-reason"
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Reason
        </Label>
        <Input
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. customer dispute, double charge…"
        />
      </div>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
      <Button
        type="submit"
        variant="destructive"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Refunding…" : "Issue refund"}
      </Button>
    </form>
  );
}

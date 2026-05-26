// apps/web/app/(lawyer)/lawyer/payouts/_components/withdraw-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { requestWithdrawal } from "@/lib/actions/payouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Server enforces PAYOUT_MIN_CENTS; this is the client-side hint only.
const MIN_WITHDRAWAL_CENTS = 50000;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export type MethodOption = {
  id: string;
  type: "gcash" | "maya" | "bank";
  accountNumber: string;
  accountHolderName: string;
};

export function WithdrawForm({
  availableCents,
  methods,
}: {
  availableCents: number;
  methods: MethodOption[];
}) {
  const router = useRouter();
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState((availableCents / 100).toFixed(2));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const noMethods = methods.length === 0;
  const nothingAvailable = availableCents < MIN_WITHDRAWAL_CENTS;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (cents < MIN_WITHDRAWAL_CENTS) {
      setError(`Minimum withdrawal is ₱${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}`);
      return;
    }
    if (cents > availableCents) {
      setError(`You can withdraw at most ₱${(availableCents / 100).toFixed(2)}`);
      return;
    }
    if (!methodId) {
      setError("Choose a payout method");
      return;
    }
    start(async () => {
      try {
        await requestWithdrawal({ payoutMethodId: methodId, amountCents: cents });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function label(m: MethodOption) {
    const kind = m.type === "bank" ? "Bank" : m.type === "gcash" ? "GCash" : "Maya";
    return `${kind} · ${m.accountNumber} (${m.accountHolderName})`;
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Banknote className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Withdraw
        </p>
      </CardHeader>
      <CardContent>
        {noMethods ? (
          <p className="text-sm text-muted-foreground">
            Add a payout method first.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wd-method" className="text-xs">
                To
              </Label>
              <select
                id="wd-method"
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                className={SELECT_CLASS}
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {label(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wd-amount" className="text-xs">
                Amount · PHP
              </Label>
              <Input
                id="wd-amount"
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Available ₱{(availableCents / 100).toFixed(2)} · a ₱10 transfer fee
                is deducted from this amount.
              </p>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              type="submit"
              disabled={pending || nothingAvailable}
              className="w-full"
            >
              {pending ? "Requesting…" : "Request withdrawal"}
            </Button>
            {nothingAvailable ? (
              <p className="text-[11px] text-muted-foreground">
                Available balance is below the ₱
                {(MIN_WITHDRAWAL_CENTS / 100).toFixed(0)} minimum.
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// apps/web/app/(lawyer)/lawyer/payouts/_components/method-form.tsx
"use client";

import { useState, useTransition } from "react";
import { Wallet } from "lucide-react";
import { addPayoutMethod } from "@/lib/actions/payouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function MethodForm() {
  const [type, setType] = useState<"gcash" | "maya" | "bank">("gcash");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isBank = type === "bank";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    start(async () => {
      try {
        await addPayoutMethod({
          type,
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim(),
          bankBic: isBank ? bankBic.trim() : null,
        });
        setSuccess(true);
        setAccountNumber("");
        setAccountHolderName("");
        setBankBic("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Wallet className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Add payout method
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pm-type" className="text-xs">
              Type
            </Label>
            <select
              id="pm-type"
              value={type}
              onChange={(e) => setType(e.target.value as "gcash" | "maya" | "bank")}
              className={SELECT_CLASS}
            >
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bank">Bank account</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pm-account" className="text-xs">
              {isBank ? "Account number" : "Mobile number"}
            </Label>
            <Input
              id="pm-account"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={isBank ? "Bank account number" : "09171234567"}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pm-holder" className="text-xs">
              Account holder name
            </Label>
            <Input
              id="pm-holder"
              required
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>

          {isBank ? (
            <div className="space-y-1.5">
              <Label htmlFor="pm-bic" className="text-xs">
                Bank (BIC / institution code)
              </Label>
              <Input
                id="pm-bic"
                required
                value={bankBic}
                onChange={(e) => setBankBic(e.target.value)}
                placeholder="e.g. BOPIPHMM"
                className="font-mono uppercase"
              />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Verified personal wallets cap around ₱100,000/month incoming — add a
              bank account if you expect larger payouts.
            </p>
          )}

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              Payout method added.
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Adding…" : "Add method"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

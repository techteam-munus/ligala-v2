// apps/web/app/(lawyer)/lawyer/payouts/_components/methods-list.tsx
"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePayoutMethod } from "@/lib/actions/payouts";
import { Button } from "@/components/ui/button";

export type MethodRow = {
  id: string;
  type: "gcash" | "maya" | "bank";
  accountNumber: string;
  accountHolderName: string;
  bankBic: string | null;
  verified: boolean;
};

export function MethodsList({ methods }: { methods: MethodRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (methods.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No payout methods yet.
      </p>
    );
  }

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    start(async () => {
      try {
        await deletePayoutMethod(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <ul className="divide-y divide-border/60">
      {error ? (
        <li className="px-4 py-2 text-xs text-destructive">{error}</li>
      ) : null}
      {methods.map((m) => {
        const kind = m.type === "bank" ? "Bank" : m.type === "gcash" ? "GCash" : "Maya";
        return (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{kind}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {m.accountNumber}
                </span>
                {m.verified ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    verified
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {m.accountHolderName}
                {m.bankBic ? ` · ${m.bankBic}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendingId === m.id}
              onClick={() => remove(m.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              {pendingId === m.id ? "Removing…" : "Remove"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

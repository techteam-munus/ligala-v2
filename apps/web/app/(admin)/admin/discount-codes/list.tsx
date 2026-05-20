"use client";

import { useState, useTransition } from "react";
import { deleteDiscountCode } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = {
  code: {
    id: string;
    code: string;
    kind: "percent" | "fixed";
    valueBps: number | null;
    valueCents: number | null;
    redemptions: number;
    maxRedemptions: number | null;
    validUntil: string | null;
  };
  lawyerEmail: string;
  lawyerName: string;
};

export function CodesList({ items }: { items: Row[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function remove(row: Row) {
    const reason = window.prompt(`Reason to remove ${row.code.code}?`)?.trim();
    if (!reason || reason.length < 3) return;
    setErr(null);
    start(async () => {
      try {
        await deleteDiscountCode(row.code.id, reason);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (items.length === 0) {
    return <p className="mt-6 text-sm text-muted-foreground">No codes yet.</p>;
  }
  return (
    <>
      {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          <ul className="divide-y">
            {items.map((r) => (
              <li key={r.code.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <p className="font-mono font-medium">{r.code.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.code.kind === "percent"
                      ? `${((r.code.valueBps ?? 0) / 100).toFixed(2)}% off`
                      : `${((r.code.valueCents ?? 0) / 100).toFixed(2)} PHP off`}{" "}
                    · by {r.lawyerName} ({r.lawyerEmail}) · {r.code.redemptions} redemptions
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => remove(r)}
                  className="border-destructive text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

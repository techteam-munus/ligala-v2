"use client";

import { useState, useTransition } from "react";
import { deleteDiscountCode } from "@/lib/actions/admin";

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
    return <p className="mt-6 text-sm text-neutral-500">No codes yet.</p>;
  }
  return (
    <>
      {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
      <ul className="mt-6 divide-y divide-neutral-200 rounded border border-neutral-200">
        {items.map((r) => (
          <li key={r.code.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div>
              <p className="font-mono font-medium">{r.code.code}</p>
              <p className="text-xs text-neutral-500">
                {r.code.kind === "percent"
                  ? `${((r.code.valueBps ?? 0) / 100).toFixed(2)}% off`
                  : `${((r.code.valueCents ?? 0) / 100).toFixed(2)} PHP off`}{" "}
                · by {r.lawyerName} ({r.lawyerEmail}) · {r.code.redemptions} redemptions
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(r)}
              className="rounded border border-red-500 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

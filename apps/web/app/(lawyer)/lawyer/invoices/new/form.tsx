"use client";

import { useState, useTransition } from "react";
import { createInvoice } from "@/lib/actions/billing";

type Line = { description: string; qty: string; unit: string };

export function NewInvoiceForm({ caseId }: { caseId: string }) {
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { description: "", qty: "1", unit: "" },
  ]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines([...lines, { description: "", qty: "1", unit: "" }]);
  }
  function removeLine(i: number) {
    if (lines.length === 1) return;
    setLines(lines.filter((_, ix) => ix !== i));
  }

  function subtotal() {
    return lines.reduce((s, l) => {
      const q = Number.parseFloat(l.qty || "0");
      const u = Number.parseFloat(l.unit || "0");
      return s + Math.round(q * u * 100);
    }, 0);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = lines
      .filter((l) => l.description && l.qty && l.unit)
      .map((l) => ({
        description: l.description,
        qtyThousandths: Math.round(Number.parseFloat(l.qty) * 1000),
        unitAmountCents: Math.round(Number.parseFloat(l.unit) * 100),
      }));
    if (parsed.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    start(async () => {
      try {
        await createInvoice({
          caseId,
          currency: "PHP",
          notesMd: notes || null,
          lines: parsed,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit (PHP)</span>
          <span></span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_120px_32px] gap-2">
            <input
              required
              value={l.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="e.g. Contract review"
            />
            <input
              required
              type="number"
              step="0.001"
              min={0}
              value={l.qty}
              onChange={(e) => update(i, { qty: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              min={0}
              value={l.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeLine(i)}
              disabled={lines.length === 1}
              className="rounded border border-neutral-300 text-sm disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addLine} className="text-sm underline">
          + add line
        </button>
      </div>
      <div className="text-right text-sm">
        <span className="text-neutral-500">Subtotal: </span>
        <strong>{(subtotal() / 100).toFixed(2)} PHP</strong>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes (Markdown)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Payment terms, references, etc."
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

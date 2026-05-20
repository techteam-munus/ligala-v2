"use client";

import { useState, useTransition } from "react";
import { createInvoice } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
        <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit (PHP)</span>
          <span></span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_120px_32px] gap-2">
            <Input
              required
              value={l.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="e.g. Contract review"
            />
            <Input
              required
              type="number"
              step="0.001"
              min={0}
              value={l.qty}
              onChange={(e) => update(i, { qty: e.target.value })}
            />
            <Input
              required
              type="number"
              step="0.01"
              min={0}
              value={l.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => removeLine(i)}
              disabled={lines.length === 1}
              className="h-9 w-9"
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addLine} className="px-0">
          + add line
        </Button>
      </div>
      <div className="text-right text-sm">
        <span className="text-muted-foreground">Subtotal: </span>
        <strong>{(subtotal() / 100).toFixed(2)} PHP</strong>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (Markdown)</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Payment terms, references, etc."
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create draft"}
      </Button>
    </form>
  );
}

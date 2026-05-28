"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createInvoice } from "@/lib/actions/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Line = { description: string; qty: string; unit: string };

function pesoNumber(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function Peso({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-muted-foreground/70">₱</span>
      {pesoNumber(cents)}
    </span>
  );
}

function lineTotalCents(l: Line): number {
  const q = Number.parseFloat(l.qty || "0");
  const u = Number.parseFloat(l.unit || "0");
  if (!Number.isFinite(q) || !Number.isFinite(u)) return 0;
  return Math.round(q * u * 100);
}

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

  const subtotal = lines.reduce((s, l) => s + lineTotalCents(l), 0);

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
      setError("Add at least one line item with a description, quantity, and unit price.");
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
    <form onSubmit={submit}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
        {/* Editor =================================================== */}
        <div className="border-b border-border/60 lg:border-b-0 lg:border-r">
          {/* Header row */}
          <div className="hidden items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_80px_120px_120px_36px]">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit · ₱</span>
            <span className="text-right">Amount</span>
            <span></span>
          </div>

          {/* Lines */}
          <ul className="divide-y divide-border/60">
            {lines.map((l, i) => {
              const total = lineTotalCents(l);
              return (
                <li
                  key={i}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_80px_120px_120px_36px] md:items-center md:gap-2"
                >
                  <Input
                    required
                    value={l.description}
                    onChange={(e) =>
                      update(i, { description: e.target.value })
                    }
                    placeholder="e.g. Contract review"
                  />
                  <Input
                    required
                    type="number"
                    step="0.001"
                    min={0}
                    value={l.qty}
                    onChange={(e) => update(i, { qty: e.target.value })}
                    className="tabular-nums md:text-right"
                  />
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min={0}
                    value={l.unit}
                    onChange={(e) => update(i, { unit: e.target.value })}
                    placeholder="0.00"
                    className="tabular-nums md:text-right"
                  />
                  <div className="flex items-center justify-end px-2 text-sm font-medium">
                    {total > 0 ? (
                      <Peso cents={total} />
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    aria-label="Remove line"
                    className="justify-self-end text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>

          {/* Add line */}
          <div className="border-t border-border/60 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLine}
            >
              <Plus />
              Add line
            </Button>
          </div>

          {/* Notes */}
          <div className="border-t border-border/60 px-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Notes · Markdown
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, references, anything the client should see…"
              />
            </div>
          </div>
        </div>

        {/* Totals + submit =========================================== */}
        <aside className="space-y-3 bg-muted/10 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Summary
          </p>

          <div className="rounded-md border border-border/60 bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Subtotal
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              <Peso cents={subtotal} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {lines.filter((l) => lineTotalCents(l) > 0).length} of{" "}
              {lines.length} line{lines.length === 1 ? "" : "s"} filled
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Discount codes can be applied by you or the client once the invoice
            is saved as a draft.
          </p>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating draft…" : "Create draft invoice"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Drafts are private. You can send to client after review.
          </p>
        </aside>
      </div>
    </form>
  );
}

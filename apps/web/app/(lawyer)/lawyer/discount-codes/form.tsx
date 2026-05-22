"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { createDiscountCode } from "@/lib/actions/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function DiscountCodesForm() {
  const [form, setForm] = useState({
    code: "",
    kind: "percent" as "percent" | "fixed",
    percent: "10",
    fixed: "",
    maxRedemptions: "",
    validUntil: "",
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    start(async () => {
      try {
        await createDiscountCode({
          code: form.code.toUpperCase(),
          kind: form.kind,
          valueBps:
            form.kind === "percent" && form.percent
              ? Math.round(Number.parseFloat(form.percent) * 100)
              : null,
          valueCents:
            form.kind === "fixed" && form.fixed
              ? Math.round(Number.parseFloat(form.fixed) * 100)
              : null,
          maxRedemptions: form.maxRedemptions
            ? Number.parseInt(form.maxRedemptions, 10)
            : null,
          validUntil: form.validUntil
            ? new Date(form.validUntil).toISOString()
            : null,
        });
        setSuccess(true);
        setForm({ ...form, code: "" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Mint a code
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs">
              Code
            </Label>
            <Input
              id="code"
              required
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase() })
              }
              className="font-mono uppercase tracking-wider"
              placeholder="LAUNCH10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kind" className="text-xs">
              Discount type
            </Label>
            <select
              id="kind"
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as "percent" | "fixed" })
              }
              className={SELECT_CLASS}
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </div>

          {form.kind === "percent" ? (
            <div className="space-y-1.5">
              <Label htmlFor="percent" className="text-xs">
                Percent
              </Label>
              <div className="relative">
                <Input
                  id="percent"
                  required
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={form.percent}
                  onChange={(e) =>
                    setForm({ ...form, percent: e.target.value })
                  }
                  className="pr-8 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="fixed" className="text-xs">
                Amount
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">
                  ₱
                </span>
                <Input
                  id="fixed"
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.fixed}
                  onChange={(e) =>
                    setForm({ ...form, fixed: e.target.value })
                  }
                  className="pl-7 tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="max" className="text-xs">
              Max redemptions
            </Label>
            <Input
              id="max"
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) =>
                setForm({ ...form, maxRedemptions: e.target.value })
              }
              placeholder="Unlimited"
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="until" className="text-xs">
              Valid until
            </Label>
            <Input
              id="until"
              type="date"
              value={form.validUntil}
              onChange={(e) =>
                setForm({ ...form, validUntil: e.target.value })
              }
              className="tabular-nums"
            />
          </div>

          {error ? (
            <p
              className={cn(
                "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
              )}
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              Code created.
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create code"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

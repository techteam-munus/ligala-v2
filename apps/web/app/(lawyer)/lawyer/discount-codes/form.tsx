"use client";

import { useState, useTransition } from "react";
import { createDiscountCode } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
    <Card className="mt-6 gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Create a code</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <form onSubmit={submit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono uppercase"
                placeholder="LAUNCH10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kind">Kind</Label>
              <select
                id="kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "fixed" })}
                className={SELECT_CLASS}
              >
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>
            {form.kind === "percent" ? (
              <div className="space-y-1.5">
                <Label htmlFor="percent">Percent</Label>
                <Input
                  id="percent"
                  required
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={form.percent}
                  onChange={(e) => setForm({ ...form, percent: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="fixed">Amount (PHP)</Label>
                <Input
                  id="fixed"
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.fixed}
                  onChange={(e) => setForm({ ...form, fixed: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="max">Max redemptions (optional)</Label>
              <Input
                id="max"
                type="number"
                min={1}
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="until">Valid until (optional)</Label>
              <Input
                id="until"
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-green-700">Created.</p> : null}
          <Button type="submit" disabled={pending} className="mt-4">
            {pending ? "Creating…" : "Create code"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

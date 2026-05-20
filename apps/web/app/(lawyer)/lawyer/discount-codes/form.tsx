"use client";

import { useState, useTransition } from "react";
import { createDiscountCode } from "@/lib/actions/billing";

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
    <form onSubmit={submit} className="mt-6 rounded border border-neutral-200 p-4">
      <h2 className="font-medium">Create a code</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="code" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Code
          </label>
          <input
            id="code"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-mono uppercase"
            placeholder="LAUNCH10"
          />
        </div>
        <div>
          <label htmlFor="kind" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Kind
          </label>
          <select
            id="kind"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "fixed" })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off</option>
          </select>
        </div>
        {form.kind === "percent" ? (
          <div>
            <label htmlFor="percent" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Percent
            </label>
            <input
              id="percent"
              required
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              value={form.percent}
              onChange={(e) => setForm({ ...form, percent: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="fixed" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Amount (PHP)
            </label>
            <input
              id="fixed"
              required
              type="number"
              min={0.01}
              step={0.01}
              value={form.fixed}
              onChange={(e) => setForm({ ...form, fixed: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <div>
          <label htmlFor="max" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Max redemptions (optional)
          </label>
          <input
            id="max"
            type="number"
            min={1}
            value={form.maxRedemptions}
            onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="until" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Valid until (optional)
          </label>
          <input
            id="until"
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-green-700">Created.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create code"}
      </button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { createCase } from "@/lib/actions/case";

type Ref = { id: string; name: string };

export function NewCaseForm({
  lawyerSlug,
  referralLinkSlug,
  practiceAreas,
  jurisdictions,
}: {
  lawyerSlug: string;
  referralLinkSlug?: string;
  practiceAreas: Ref[];
  jurisdictions: Ref[];
}) {
  const [form, setForm] = useState({
    lawyerSlug,
    type: "paid" as "paid" | "probono",
    title: "",
    description: "",
    practiceAreaId: "",
    jurisdictionId: "",
    probonoReason: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!form.lawyerSlug) {
      setError("Pick a lawyer from /lawyers first.");
      return;
    }
    startTransition(async () => {
      try {
        await createCase({
          lawyerSlug: form.lawyerSlug,
          type: form.type,
          title: form.title,
          description: form.description,
          practiceAreaId: form.practiceAreaId || null,
          jurisdictionId: form.jurisdictionId || null,
          referralLinkSlug: referralLinkSlug || undefined,
          probonoReason:
            form.type === "probono" && form.probonoReason
              ? form.probonoReason
              : undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create case");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <input type="hidden" name="lawyerSlug" value={form.lawyerSlug} />
      <div>
        <label htmlFor="type" className="block text-sm font-medium">Type</label>
        <select
          id="type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as "paid" | "probono" })}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="paid">Paid engagement</option>
          <option value="probono">Pro bono request</option>
        </select>
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium">Title</label>
        <input
          id="title"
          required
          minLength={3}
          maxLength={200}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="One-line summary"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium">Description</label>
        <textarea
          id="description"
          required
          minLength={10}
          maxLength={8000}
          rows={6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Background, what you need help with, timeline."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="practiceAreaId" className="block text-sm font-medium">Practice area</label>
          <select
            id="practiceAreaId"
            value={form.practiceAreaId}
            onChange={(e) => setForm({ ...form, practiceAreaId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Not sure —</option>
            {practiceAreas.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="jurisdictionId" className="block text-sm font-medium">Jurisdiction</label>
          <select
            id="jurisdictionId"
            value={form.jurisdictionId}
            onChange={(e) => setForm({ ...form, jurisdictionId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Not sure —</option>
            {jurisdictions.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
        </div>
      </div>
      {form.type === "probono" ? (
        <div>
          <label htmlFor="probonoReason" className="block text-sm font-medium">
            Pro bono eligibility (optional)
          </label>
          <textarea
            id="probonoReason"
            value={form.probonoReason}
            onChange={(e) => setForm({ ...form, probonoReason: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            placeholder="Indigency, household size, income, or other context."
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit case"}
      </button>
    </form>
  );
}

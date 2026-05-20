"use client";

import { useState, useTransition } from "react";
import { createCase } from "@/lib/actions/case";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Ref = { id: string; name: string };

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
      <div className="space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as "paid" | "probono" })}
          className={SELECT_CLASS}
        >
          <option value="paid">Paid engagement</option>
          <option value="probono">Pro bono request</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          minLength={3}
          maxLength={200}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="One-line summary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          required
          minLength={10}
          maxLength={8000}
          rows={6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Background, what you need help with, timeline."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="practiceAreaId">Practice area</Label>
          <select
            id="practiceAreaId"
            value={form.practiceAreaId}
            onChange={(e) => setForm({ ...form, practiceAreaId: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">— Not sure —</option>
            {practiceAreas.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jurisdictionId">Jurisdiction</Label>
          <select
            id="jurisdictionId"
            value={form.jurisdictionId}
            onChange={(e) => setForm({ ...form, jurisdictionId: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">— Not sure —</option>
            {jurisdictions.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
        </div>
      </div>
      {form.type === "probono" ? (
        <div className="space-y-1.5">
          <Label htmlFor="probonoReason">Pro bono eligibility (optional)</Label>
          <Textarea
            id="probonoReason"
            value={form.probonoReason}
            onChange={(e) => setForm({ ...form, probonoReason: e.target.value })}
            rows={3}
            placeholder="Indigency, household size, income, or other context."
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit case"}
      </Button>
    </form>
  );
}

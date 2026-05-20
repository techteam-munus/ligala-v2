"use client";

import { useState, useTransition } from "react";
import { createReferral } from "@/lib/actions/referral";

export function OutboundForm() {
  const [slug, setSlug] = useState("");
  const [caseId, setCaseId] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okAt, setOkAt] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkAt(null);
    start(async () => {
      try {
        await createReferral({
          toLawyerSlug: slug.trim(),
          caseId: caseId.trim() || undefined,
          noteMd: note.trim() || undefined,
        });
        setSlug("");
        setCaseId("");
        setNote("");
        setOkAt(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded border border-neutral-200 p-4">
      <h2 className="font-medium">Refer a case</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Recipient must be a KYC-verified lawyer. Attach a case id to hand off
        the case on acceptance.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Recipient lawyer slug</span>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="atty-final"
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Case id (optional)</span>
          <input
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="uuid…"
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm font-mono"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="font-medium">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Why this lawyer, what's been discussed already…"
        />
      </label>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {okAt ? <p className="mt-2 text-sm text-green-700">Referral sent at {okAt}.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send referral"}
      </button>
    </form>
  );
}

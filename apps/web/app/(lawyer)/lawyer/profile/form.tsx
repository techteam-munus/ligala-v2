"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveLawyerProfile } from "@/lib/actions/lawyer";

type Ref = { id: string; name: string };

type Initial = {
  slug: string;
  barNumber: string;
  ibpChapterId: string;
  bio: string;
  practiceAreaIds: string[];
  jurisdictionIds: string[];
  probonoAvailable: boolean;
  probonoStatement: string;
};

export function LawyerProfileForm({
  initial,
  ibpChapters,
  practiceAreas,
  jurisdictions,
}: {
  initial: Initial;
  ibpChapters: Ref[];
  practiceAreas: Ref[];
  jurisdictions: Ref[];
}) {
  const [slug, setSlug] = useState(initial.slug);
  const [barNumber, setBarNumber] = useState(initial.barNumber);
  const [ibpChapterId, setIbpChapterId] = useState(initial.ibpChapterId);
  const [bio, setBio] = useState(initial.bio);
  const [practiceAreaIds, setPracticeAreaIds] = useState<Set<string>>(
    new Set(initial.practiceAreaIds),
  );
  const [jurisdictionIds, setJurisdictionIds] = useState<Set<string>>(
    new Set(initial.jurisdictionIds),
  );
  const [probonoAvailable, setProbonoAvailable] = useState(initial.probonoAvailable);
  const [probonoStatement, setProbonoStatement] = useState(initial.probonoStatement);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveLawyerProfile({
          slug: slug || undefined,
          barNumber: barNumber || null,
          ibpChapterId: ibpChapterId || null,
          bio: bio || null,
          practiceAreaIds: [...practiceAreaIds],
          jurisdictionIds: [...jurisdictionIds],
          probonoAvailable,
          probonoStatement: probonoStatement || null,
        });
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Public URL slug</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="juan-dela-cruz"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <span className="text-xs text-neutral-500">
          Lowercase letters, digits, hyphens.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Bar number</span>
        <input
          type="text"
          value={barNumber}
          onChange={(e) => setBarNumber(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">IBP chapter</span>
        <select
          value={ibpChapterId}
          onChange={(e) => setIbpChapterId(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="">— select —</option>
          {ibpChapters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Practice areas</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {practiceAreas.map((pa) => (
            <label key={pa.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={practiceAreaIds.has(pa.id)}
                onChange={() => toggle(practiceAreaIds, setPracticeAreaIds, pa.id)}
              />
              {pa.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Jurisdictions</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {jurisdictions.map((j) => (
            <label key={j.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={jurisdictionIds.has(j.id)}
                onChange={() => toggle(jurisdictionIds, setJurisdictionIds, j.id)}
              />
              {j.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-medium">Pro bono</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={probonoAvailable}
            onChange={(e) => setProbonoAvailable(e.target.checked)}
          />
          I&apos;m open to pro bono cases.
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium">Pro bono note (public)</span>
          <textarea
            value={probonoStatement}
            onChange={(e) => setProbonoStatement(e.target.value)}
            rows={2}
            placeholder="Eligibility, hours per month, etc."
            className="rounded border border-neutral-300 px-3 py-2"
            disabled={!probonoAvailable}
          />
        </label>
      </fieldset>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {savedAt && !error && (
        <p className="text-sm text-emerald-700">Saved at {savedAt}.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}

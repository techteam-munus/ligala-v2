"use client";

import { useState, useTransition } from "react";
import { saveClientProfile } from "@/lib/actions/client";

type Initial = {
  displayName: string;
  phone: string;
  city: string;
  region: string;
  preferredLanguage: string;
};

export function ClientProfileForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveClientProfile({
          displayName: form.displayName || null,
          phone: form.phone || null,
          city: form.city || null,
          region: form.region || null,
          preferredLanguage: form.preferredLanguage || "en",
        });
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="What lawyers should call you"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Phone
          </label>
          <input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            placeholder="+63…"
          />
        </div>
        <div>
          <label htmlFor="preferredLanguage" className="block text-sm font-medium">
            Preferred language
          </label>
          <select
            id="preferredLanguage"
            value={form.preferredLanguage}
            onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="en">English</option>
            <option value="fil">Filipino</option>
            <option value="ceb">Cebuano</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="city" className="block text-sm font-medium">
            City
          </label>
          <input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="region" className="block text-sm font-medium">
            Region
          </label>
          <input
            id="region"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
        {savedAt ? (
          <span className="text-xs text-green-700">Saved at {savedAt}</span>
        ) : null}
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}

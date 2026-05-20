"use client";

import { useState, useTransition } from "react";
import { saveClientProfile } from "@/lib/actions/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Initial = {
  displayName: string;
  phone: string;
  city: string;
  region: string;
  preferredLanguage: string;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="What lawyers should call you"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+63…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preferredLanguage">Preferred language</Label>
          <select
            id="preferredLanguage"
            value={form.preferredLanguage}
            onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="en">English</option>
            <option value="fil">Filipino</option>
            <option value="ceb">Cebuano</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {savedAt ? (
          <span className="text-xs text-green-700">Saved at {savedAt}</span>
        ) : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}

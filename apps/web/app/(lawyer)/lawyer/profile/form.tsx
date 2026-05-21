"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveLawyerProfile } from "@/lib/actions/lawyer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Ref = { id: string; name: string };

type Initial = {
  slug: string;
  ibpChapterId: string;
  bio: string;
  practiceAreaIds: string[];
  jurisdictionIds: string[];
  probonoAvailable: boolean;
  probonoStatement: string;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
      <div className="space-y-1.5">
        <Label htmlFor="slug">Public URL slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="juan-dela-cruz"
        />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, digits, hyphens.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ibpChapterId">IBP chapter</Label>
        <select
          id="ibpChapterId"
          value={ibpChapterId}
          onChange={(e) => setIbpChapterId(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">— select —</option>
          {ibpChapters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Practice areas</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {practiceAreas.map((pa) => (
            <label key={pa.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={practiceAreaIds.has(pa.id)}
                onChange={() => toggle(practiceAreaIds, setPracticeAreaIds, pa.id)}
                className="h-4 w-4 rounded border-input"
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
                className="h-4 w-4 rounded border-input"
              />
              {j.name}
            </label>
          ))}
        </div>
      </fieldset>

      <Card>
        <CardHeader className="px-4">
          <CardTitle className="text-base">Pro bono</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={probonoAvailable}
              onChange={(e) => setProbonoAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            I&apos;m open to pro bono cases.
          </label>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="probonoStatement">Pro bono note (public)</Label>
            <Textarea
              id="probonoStatement"
              value={probonoStatement}
              onChange={(e) => setProbonoStatement(e.target.value)}
              rows={2}
              placeholder="Eligibility, hours per month, etc."
              disabled={!probonoAvailable}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {savedAt && !error && (
        <p className="text-sm text-emerald-700">Saved at {savedAt}.</p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

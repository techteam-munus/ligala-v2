"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Briefcase,
  Building2,
  Check,
  Globe,
  HeartHandshake,
  User,
} from "lucide-react";
import { saveLawyerProfile } from "@/lib/actions/lawyer";
import { cn } from "@/lib/utils";
import { AvatarUpload } from "@/app/_components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

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
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function LawyerProfileForm({
  initial,
  avatarUrl,
  fallbackInitial,
  ibpChapters,
  practiceAreas,
  jurisdictions,
}: {
  initial: Initial;
  avatarUrl: string | null;
  fallbackInitial: string;
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
  const [probonoAvailable, setProbonoAvailable] = useState(
    initial.probonoAvailable,
  );
  const [probonoStatement, setProbonoStatement] = useState(
    initial.probonoStatement,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(
    set: Set<string>,
    setSet: (s: Set<string>) => void,
    id: string,
  ) {
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
    <form onSubmit={onSubmit}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        {/* Left column: Identity + Expertise ----------------------- */}
        <div className="space-y-4">
          {/* Identity */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <User className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Identity
              </p>
            </div>
            <CardContent className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Public URL slug</Label>
                <div className="flex items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                  <span className="shrink-0 px-3 py-1 text-sm text-muted-foreground border-r border-input">
                    ligala.ph/lawyers/
                  </span>
                  <input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="juan-dela-cruz"
                    className="w-full min-w-0 flex-1 bg-transparent px-3 py-1 font-mono text-sm outline-none"
                  />
                </div>
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
                  rows={5}
                  placeholder="A short paragraph for clients: years of practice, focus areas, what you'd like to be known for…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Practice areas */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Briefcase className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Practice areas
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {practiceAreaIds.size}
              </span>
            </div>
            <CardContent className="px-4 py-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Pick everything that applies. Shown on your public profile and
                used by client search.
              </p>
              <ChipGrid
                items={practiceAreas}
                selected={practiceAreaIds}
                onToggle={(id) =>
                  toggle(practiceAreaIds, setPracticeAreaIds, id)
                }
              />
            </CardContent>
          </Card>

          {/* Jurisdictions */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Globe className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Jurisdictions
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {jurisdictionIds.size}
              </span>
            </div>
            <CardContent className="px-4 py-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Courts and venues where you appear.
              </p>
              <ChipGrid
                items={jurisdictions}
                selected={jurisdictionIds}
                onToggle={(id) =>
                  toggle(jurisdictionIds, setJurisdictionIds, id)
                }
              />
            </CardContent>
          </Card>
        </div>

        {/* Right rail: Photo + Pro bono + Save --------------------- */}
        <aside className="space-y-4 lg:self-start">
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <User className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Profile photo
              </p>
            </div>
            <CardContent className="px-4 py-4">
              <AvatarUpload
                currentUrl={avatarUrl}
                fallbackInitial={fallbackInitial}
              />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Shown on your public profile and in the lawyer directory.
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "gap-0 py-0 transition-colors",
              probonoAvailable &&
                "ring-violet-200/70 dark:ring-violet-900/40 bg-violet-50/20 dark:bg-violet-950/10",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <HeartHandshake className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Pro bono
              </p>
            </div>
            <CardContent className="space-y-3 px-4 py-4">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={probonoAvailable}
                  onChange={(e) => setProbonoAvailable(e.target.checked)}
                  className="size-4 rounded border-input accent-violet-600"
                />
                <span className="font-medium">
                  I&apos;m open to pro bono cases
                </span>
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="probonoStatement" className="text-xs">
                  Public note · optional
                </Label>
                <Textarea
                  id="probonoStatement"
                  value={probonoStatement}
                  onChange={(e) => setProbonoStatement(e.target.value)}
                  rows={3}
                  placeholder="Eligibility, hours per month, focus areas…"
                  disabled={!probonoAvailable}
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="gap-3">
            <CardContent className="space-y-3">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {savedAt && !error ? (
                <Alert className="border-emerald-200/60 bg-emerald-50/40 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                  <AlertDescription>
                    Saved at {savedAt}.
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Saving…" : "Save profile"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Changes are visible on your public profile immediately.
              </p>
            </CardContent>
          </Card>

          <Card size="sm" className="gap-2 bg-muted/20">
            <CardContent>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Building2 className="mr-1 inline size-3" />
                Tip
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Specific practice areas + jurisdictions help your profile rank
                higher when clients filter the directory.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </form>
  );
}

function ChipGrid({
  items,
  selected,
  onToggle,
}: {
  items: Ref[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.has(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              on
                ? "border-transparent bg-foreground text-background"
                : "border-border/60 bg-card text-foreground hover:border-foreground/40 hover:bg-muted/40",
            )}
            aria-pressed={on}
          >
            <span
              className={cn(
                "flex size-3 items-center justify-center rounded-full border transition-colors",
                on
                  ? "border-background/30 bg-background/15"
                  : "border-border/60",
              )}
            >
              {on ? <Check className="size-2" /> : null}
            </span>
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

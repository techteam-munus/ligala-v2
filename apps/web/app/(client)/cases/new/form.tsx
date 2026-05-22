"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Briefcase,
  FileText,
  Gavel,
  HeartHandshake,
  Info,
  Link2,
  Scale,
  Send,
  User,
} from "lucide-react";
import { createCase } from "@/lib/actions/case";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Ref = { id: string; name: string };

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function NewCaseForm({
  lawyerSlug,
  lawyerName,
  referralLinkSlug,
  referralLabel,
  practiceAreas,
  jurisdictions,
}: {
  lawyerSlug: string;
  lawyerName: string | null;
  referralLinkSlug?: string;
  referralLabel?: string | null;
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

  const titleChars = form.title.length;
  const descChars = form.description.length;
  const valid =
    !!form.lawyerSlug && form.title.length >= 3 && form.description.length >= 10;

  return (
    <form onSubmit={submit}>
      <input type="hidden" name="lawyerSlug" value={form.lawyerSlug} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Form ============================================== */}
        <div className="space-y-4">
          {/* Type selector */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Briefcase className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Engagement type
              </p>
            </div>
            <CardContent className="px-4 py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <TypeChoice
                  selected={form.type === "paid"}
                  onSelect={() => setForm({ ...form, type: "paid" })}
                  icon={<Gavel className="size-4" />}
                  label="Paid engagement"
                  description="Standard fee arrangement (lawyer sends terms after accept)."
                  accent="emerald"
                />
                <TypeChoice
                  selected={form.type === "probono"}
                  onSelect={() => setForm({ ...form, type: "probono" })}
                  icon={<HeartHandshake className="size-4" />}
                  label="Pro bono request"
                  description="Free legal aid for qualifying matters."
                  accent="violet"
                />
              </div>
            </CardContent>
          </Card>

          {/* Title + description */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <FileText className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Case details
              </p>
            </div>
            <CardContent className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Title</Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      titleChars > 0 && titleChars < 3
                        ? "text-amber-600"
                        : titleChars > 180
                          ? "text-rose-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {titleChars} / 200
                  </span>
                </div>
                <Input
                  id="title"
                  required
                  minLength={3}
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="One-line summary of what you need help with"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Description</Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      descChars > 0 && descChars < 10
                        ? "text-amber-600"
                        : descChars > 7500
                          ? "text-rose-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {descChars} / 8000
                  </span>
                </div>
                <Textarea
                  id="description"
                  required
                  minLength={10}
                  maxLength={8000}
                  rows={7}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Background, what you need help with, any timeline or urgency. Don't worry about legal terminology — the lawyer will translate."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="practiceAreaId">
                    <Scale className="mr-1 inline size-3" />
                    Practice area
                  </Label>
                  <select
                    id="practiceAreaId"
                    value={form.practiceAreaId}
                    onChange={(e) =>
                      setForm({ ...form, practiceAreaId: e.target.value })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="">Not sure — let the lawyer pick</option>
                    {practiceAreas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jurisdictionId">Jurisdiction</Label>
                  <select
                    id="jurisdictionId"
                    value={form.jurisdictionId}
                    onChange={(e) =>
                      setForm({ ...form, jurisdictionId: e.target.value })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="">Not sure — let the lawyer pick</option>
                    {jurisdictions.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pro bono reason */}
          {form.type === "probono" ? (
            <Card
              className={cn(
                "gap-0 py-0 ring-violet-200/70 bg-violet-50/20 dark:ring-violet-900/40 dark:bg-violet-950/10",
              )}
            >
              <div className="flex items-center gap-2 border-b border-violet-200/60 px-4 py-3 dark:border-violet-900/40">
                <HeartHandshake className="size-3.5 text-violet-700 dark:text-violet-300" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                  Pro bono eligibility
                </p>
              </div>
              <CardContent className="px-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="probonoReason" className="text-xs">
                    Context · optional
                  </Label>
                  <Textarea
                    id="probonoReason"
                    value={form.probonoReason}
                    onChange={(e) =>
                      setForm({ ...form, probonoReason: e.target.value })
                    }
                    rows={4}
                    placeholder="Indigency, household size, monthly income, or any other context that helps the lawyer assess your eligibility."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lawyers decide pro bono eligibility individually. This
                    context is only seen by the lawyer you&apos;re engaging.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Side rail ========================================= */}
        <aside className="space-y-4 lg:self-start">
          {/* Engaging this lawyer */}
          {lawyerName ? (
            <Card size="sm" className="gap-3">
              <CardContent className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Engaging
                </p>
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <User className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lawyerName}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      /lawyers/{lawyerSlug}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/lawyers/${lawyerSlug}` as never}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  View public page →
                </Link>
              </CardContent>
            </Card>
          ) : !form.lawyerSlug ? (
            <Card
              size="sm"
              className="gap-2 ring-amber-200/70 bg-amber-50/40 dark:ring-amber-900/40 dark:bg-amber-950/20"
            >
              <CardContent>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                  Pick a lawyer first
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to choose a lawyer from the directory before
                  submitting a case.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                  <Link href="/lawyers">Browse directory</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Referral attribution */}
          {referralLinkSlug ? (
            <Card
              size="sm"
              className="gap-2 ring-sky-200/70 bg-sky-50/30 dark:ring-sky-900/40 dark:bg-sky-950/15"
            >
              <CardContent>
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                  <Link2 className="size-3" />
                  Referred via link
                </p>
                <p className="mt-1 font-mono text-sm">
                  {referralLinkSlug}
                </p>
                {referralLabel ? (
                  <p className="text-[11px] text-muted-foreground">
                    {referralLabel}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Submit */}
          <Card size="sm" className="gap-3">
            <CardContent className="space-y-3">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                disabled={pending || !valid}
                className="w-full"
              >
                {pending ? (
                  "Submitting…"
                ) : (
                  <>
                    <Send />
                    Submit to lawyer
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {!valid && form.lawyerSlug
                  ? "Add a title (3+ chars) and description (10+ chars) to submit."
                  : "Your case is private to you and the lawyer you submit to."}
              </p>
            </CardContent>
          </Card>

          {/* Helper tip */}
          <Card size="sm" className="gap-2 bg-muted/20">
            <CardContent>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Info className="mr-1 inline size-3" />
                What happens next
              </p>
              <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <Step n={1}>Lawyer reviews and accepts or declines.</Step>
                <Step n={2}>
                  Paid: lawyer sends engagement terms; you sign to start.
                </Step>
                <Step n={3}>
                  Pro bono: work starts directly on acceptance.
                </Step>
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </form>
  );
}

function TypeChoice({
  selected,
  onSelect,
  icon,
  label,
  description,
  accent,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent: "emerald" | "violet";
}) {
  const accentRing =
    accent === "emerald"
      ? "ring-emerald-300/70 bg-emerald-50/40 dark:ring-emerald-900/40 dark:bg-emerald-950/20"
      : "ring-violet-300/70 bg-violet-50/40 dark:ring-violet-900/40 dark:bg-violet-950/20";
  const accentText =
    accent === "emerald"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-violet-700 dark:text-violet-300";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-start gap-1.5 rounded-md border bg-card px-3 py-3 text-left transition-colors",
        selected
          ? cn("border-transparent ring-2 ring-inset", accentRing)
          : "border-border/60 hover:border-foreground/30 hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium",
          selected && accentText,
        )}
      >
        {icon}
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{description}</span>
      {selected ? (
        <span
          className={cn(
            "absolute right-2 top-2 inline-flex size-4 items-center justify-center rounded-full text-[10px]",
            accent === "emerald" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white",
          )}
          aria-hidden
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-[10px] font-semibold tabular-nums">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

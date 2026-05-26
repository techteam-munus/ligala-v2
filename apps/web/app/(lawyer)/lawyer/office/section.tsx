"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Building,
  CalendarDays,
  HelpCircle,
  MoonStar,
  Trash2,
} from "lucide-react";
import {
  addOfficeFaq,
  createOffice,
  deleteOfficeFaq,
  saveOfficeSchedule,
  updateOffice,
} from "@/lib/actions/lawyer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type ScheduleEntry = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

type Faq = { id: string; question: string; answer: string; sortOrder: number };

type Office = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaultSchedule(): ScheduleEntry[] {
  return DAYS.map((_, i) => ({
    dayOfWeek: i,
    opensAt: i === 0 || i === 6 ? null : "09:00",
    closesAt: i === 0 || i === 6 ? null : "17:00",
    isClosed: i === 0 || i === 6,
  }));
}

// Postgres `time` serializes as "HH:MM:SS"; the API schema (and HTML
// `<input type="time">`) want "HH:MM". Trim on load so the form round-trips
// cleanly without the user having to retype every cell.
function toHHMM(t: string | null): string | null {
  if (!t) return null;
  return t.length > 5 ? t.slice(0, 5) : t;
}

function normalizeEntry(e: ScheduleEntry): ScheduleEntry {
  return { ...e, opensAt: toHHMM(e.opensAt), closesAt: toHHMM(e.closesAt) };
}

export function OfficeSection({
  initial,
}: {
  initial: { office: Office | null; schedule: ScheduleEntry[]; faqs: Faq[] };
}) {
  const [office, setOffice] = useState(
    initial.office ?? {
      id: "",
      name: "",
      addressLine1: "",
      city: "",
      region: "",
      phone: "",
      email: "",
      website: "",
    },
  );
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(() => {
    if (initial.schedule.length === 0) return defaultSchedule();
    const defaults = defaultSchedule();
    return defaults.map((def, i) => {
      const found = initial.schedule.find((s) => s.dayOfWeek === i);
      return found ? normalizeEntry(found) : def;
    });
  });
  const [faqs, setFaqs] = useState<Faq[]>(initial.faqs);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasOffice = !!initial.office;

  function onSubmitOffice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          name: office.name,
          addressLine1: office.addressLine1 || null,
          city: office.city || null,
          region: office.region || null,
          phone: office.phone || null,
          email: office.email || null,
          website: office.website || null,
          country: "PH",
        };
        if (hasOffice) await updateOffice(payload);
        else await createOffice(payload);
        setSavedNote("Office saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onSubmitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveOfficeSchedule({ entries: schedule });
        setSavedNote("Schedule saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onAddFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addOfficeFaq({
          question: newFaq.question,
          answer: newFaq.answer,
          sortOrder: faqs.length,
        });
        setFaqs((prev) => [
          ...prev,
          { id: `local-${prev.length}`, ...newFaq, sortOrder: prev.length },
        ]);
        setNewFaq({ question: "", answer: "" });
        setSavedNote("FAQ added.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Add failed");
      }
    });
  }

  function onDeleteFaq(id: string) {
    startTransition(async () => {
      try {
        await deleteOfficeFaq(id);
        setFaqs((prev) => prev.filter((f) => f.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {savedNote && !error ? (
        <Alert className="border-emerald-200/60 bg-emerald-50/40 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
          <AlertDescription>{savedNote}</AlertDescription>
        </Alert>
      ) : null}

      {/* Details ------------------------------------------------------- */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Building className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Details
            </p>
          </div>
        </div>
        <CardContent className="px-4 py-4">
          <form onSubmit={onSubmitOffice} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="office-name">Office name</Label>
              <Input
                id="office-name"
                required
                value={office.name}
                onChange={(e) => setOffice({ ...office, name: e.target.value })}
                placeholder="Cruz & Associates Law Offices"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-address">Address</Label>
              <Input
                id="office-address"
                value={office.addressLine1 ?? ""}
                onChange={(e) =>
                  setOffice({ ...office, addressLine1: e.target.value })
                }
                placeholder="Suite 1502, Ortigas Center"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="office-city">City</Label>
                <Input
                  id="office-city"
                  value={office.city ?? ""}
                  onChange={(e) =>
                    setOffice({ ...office, city: e.target.value })
                  }
                  placeholder="Pasig"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="office-region">Region</Label>
                <Input
                  id="office-region"
                  value={office.region ?? ""}
                  onChange={(e) =>
                    setOffice({ ...office, region: e.target.value })
                  }
                  placeholder="NCR"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="office-phone">Phone</Label>
                <Input
                  id="office-phone"
                  value={office.phone ?? ""}
                  onChange={(e) =>
                    setOffice({ ...office, phone: e.target.value })
                  }
                  placeholder="+63 2 8xxx xxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="office-email">Email</Label>
                <Input
                  id="office-email"
                  type="email"
                  value={office.email ?? ""}
                  onChange={(e) =>
                    setOffice({ ...office, email: e.target.value })
                  }
                  placeholder="hello@office.ph"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-website">Website</Label>
              <Input
                id="office-website"
                type="url"
                value={office.website ?? ""}
                onChange={(e) =>
                  setOffice({ ...office, website: e.target.value })
                }
                placeholder="https://example.ph"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={isPending}>
                {hasOffice ? "Save office" : "Create office"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Schedule ------------------------------------------------------ */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Weekly schedule
            </p>
          </div>
        </div>
        <CardContent className="px-0 py-0">
          <form onSubmit={onSubmitSchedule}>
            <ul className="divide-y divide-border/60">
              {schedule.map((entry, i) => (
                <li
                  key={i}
                  className={cn(
                    "grid items-center gap-2 px-4 py-2.5 text-sm",
                    "grid-cols-2 sm:grid-cols-[90px_1fr_1fr_100px] sm:gap-3",
                    entry.isClosed && "bg-muted/20",
                  )}
                >
                  <span
                    className={cn(
                      "col-span-2 font-medium sm:col-span-1",
                      entry.isClosed && "text-muted-foreground",
                    )}
                  >
                    {DAYS[i]}
                  </span>
                  <Input
                    type="time"
                    value={entry.opensAt ?? ""}
                    disabled={entry.isClosed}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[i] = {
                        ...next[i]!,
                        opensAt: e.target.value || null,
                      };
                      setSchedule(next);
                    }}
                    className="h-8 tabular-nums"
                  />
                  <Input
                    type="time"
                    value={entry.closesAt ?? ""}
                    disabled={entry.isClosed}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[i] = {
                        ...next[i]!,
                        closesAt: e.target.value || null,
                      };
                      setSchedule(next);
                    }}
                    className="h-8 tabular-nums"
                  />
                  <label
                    className={cn(
                      "col-span-2 inline-flex items-center justify-start gap-1.5 text-xs sm:col-span-1 sm:justify-end",
                      entry.isClosed
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <MoonStar className="size-3" />
                    <input
                      type="checkbox"
                      checked={entry.isClosed}
                      onChange={(e) => {
                        const next = [...schedule];
                        next[i] = {
                          ...next[i]!,
                          isClosed: e.target.checked,
                        };
                        setSchedule(next);
                      }}
                      className="size-3.5 rounded border-input accent-foreground"
                    />
                    Closed
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {!hasOffice
                  ? "Create the office first to save a schedule."
                  : "Times shown in your local timezone."}
              </p>
              <Button type="submit" disabled={isPending || !hasOffice}>
                Save schedule
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* FAQs ---------------------------------------------------------- */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              FAQs
            </p>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {faqs.length}
            </span>
          </div>
        </div>
        <CardContent className="px-0 py-0">
          {faqs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No FAQs yet. Add a question + answer below.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {faqs.map((faq) => (
                <li
                  key={faq.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{faq.question}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteFaq(faq.id)}
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={onAddFaq}
            className="space-y-2 border-t border-border/60 bg-muted/20 px-4 py-3"
          >
            <Input
              required
              placeholder="Question"
              value={newFaq.question}
              onChange={(e) =>
                setNewFaq({ ...newFaq, question: e.target.value })
              }
              className="bg-background"
            />
            <Textarea
              required
              placeholder="Answer"
              value={newFaq.answer}
              onChange={(e) =>
                setNewFaq({ ...newFaq, answer: e.target.value })
              }
              rows={2}
              className="bg-background"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isPending || !hasOffice}
              >
                Add FAQ
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

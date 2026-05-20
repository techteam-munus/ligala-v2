"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  addOfficeFaq,
  createOffice,
  deleteOfficeFaq,
  saveOfficeSchedule,
  updateOffice,
} from "@/lib/actions/lawyer";
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultSchedule(): ScheduleEntry[] {
  return DAYS.map((_, i) => ({
    dayOfWeek: i,
    opensAt: i === 0 || i === 6 ? null : "09:00",
    closesAt: i === 0 || i === 6 ? null : "17:00",
    isClosed: i === 0 || i === 6,
  }));
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
    return defaults.map(
      (def, i) => initial.schedule.find((s) => s.dayOfWeek === i) ?? def,
    );
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
    <div className="mt-8 flex flex-col gap-10">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {savedNote && !error && (
        <p className="text-sm text-emerald-700">{savedNote}</p>
      )}

      <form onSubmit={onSubmitOffice} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Details</h2>
        <div className="space-y-1.5">
          <Label htmlFor="office-name">Office name</Label>
          <Input
            id="office-name"
            required
            value={office.name}
            onChange={(e) => setOffice({ ...office, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-address">Address</Label>
          <Input
            id="office-address"
            value={office.addressLine1 ?? ""}
            onChange={(e) => setOffice({ ...office, addressLine1: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="office-city">City</Label>
            <Input
              id="office-city"
              value={office.city ?? ""}
              onChange={(e) => setOffice({ ...office, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-region">Region</Label>
            <Input
              id="office-region"
              value={office.region ?? ""}
              onChange={(e) => setOffice({ ...office, region: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="office-phone">Phone</Label>
            <Input
              id="office-phone"
              value={office.phone ?? ""}
              onChange={(e) => setOffice({ ...office, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-email">Email</Label>
            <Input
              id="office-email"
              type="email"
              value={office.email ?? ""}
              onChange={(e) => setOffice({ ...office, email: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-website">Website</Label>
          <Input
            id="office-website"
            type="url"
            value={office.website ?? ""}
            onChange={(e) => setOffice({ ...office, website: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={isPending} className="self-start">
          {hasOffice ? "Save office" : "Create office"}
        </Button>
      </form>

      <form onSubmit={onSubmitSchedule} className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Schedule</h2>
        <div className="grid grid-cols-[60px_1fr_1fr_80px] items-center gap-2 text-sm">
          <span className="font-medium">Day</span>
          <span className="font-medium">Opens</span>
          <span className="font-medium">Closes</span>
          <span className="font-medium">Closed</span>
          {schedule.map((entry, i) => (
            <div key={i} className="contents">
              <span>{DAYS[i]}</span>
              <Input
                type="time"
                value={entry.opensAt ?? ""}
                disabled={entry.isClosed}
                onChange={(e) => {
                  const next = [...schedule];
                  next[i] = { ...next[i]!, opensAt: e.target.value || null };
                  setSchedule(next);
                }}
                className="h-8"
              />
              <Input
                type="time"
                value={entry.closesAt ?? ""}
                disabled={entry.isClosed}
                onChange={(e) => {
                  const next = [...schedule];
                  next[i] = { ...next[i]!, closesAt: e.target.value || null };
                  setSchedule(next);
                }}
                className="h-8"
              />
              <input
                type="checkbox"
                checked={entry.isClosed}
                onChange={(e) => {
                  const next = [...schedule];
                  next[i] = { ...next[i]!, isClosed: e.target.checked };
                  setSchedule(next);
                }}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          ))}
        </div>
        <Button
          type="submit"
          disabled={isPending || !hasOffice}
          className="self-start"
        >
          Save schedule
        </Button>
        {!hasOffice && (
          <span className="text-xs text-muted-foreground">
            Create the office first to save a schedule.
          </span>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">FAQs</h2>
        <ul className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <li key={faq.id}>
              <Card className="gap-2 py-3">
                <CardContent className="px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{faq.question}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteFaq(faq.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <form onSubmit={onAddFaq} className="flex flex-col gap-2">
          <Input
            required
            placeholder="Question"
            value={newFaq.question}
            onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
          />
          <Textarea
            required
            placeholder="Answer"
            value={newFaq.answer}
            onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
            rows={2}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || !hasOffice}
            className="self-start"
          >
            Add FAQ
          </Button>
        </form>
      </section>
    </div>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  addOfficeFaq,
  createOffice,
  deleteOfficeFaq,
  saveOfficeSchedule,
  updateOffice,
} from "@/lib/actions/lawyer";

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
        // Server-revalidated path will rehydrate; for instant UX add locally too.
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
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {savedNote && !error && (
        <p className="text-sm text-emerald-700">{savedNote}</p>
      )}

      <form onSubmit={onSubmitOffice} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Details</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Office name</span>
          <input
            type="text"
            required
            value={office.name}
            onChange={(e) => setOffice({ ...office, name: e.target.value })}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Address</span>
          <input
            type="text"
            value={office.addressLine1 ?? ""}
            onChange={(e) => setOffice({ ...office, addressLine1: e.target.value })}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">City</span>
            <input
              type="text"
              value={office.city ?? ""}
              onChange={(e) => setOffice({ ...office, city: e.target.value })}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Region</span>
            <input
              type="text"
              value={office.region ?? ""}
              onChange={(e) => setOffice({ ...office, region: e.target.value })}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Phone</span>
            <input
              type="text"
              value={office.phone ?? ""}
              onChange={(e) => setOffice({ ...office, phone: e.target.value })}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              value={office.email ?? ""}
              onChange={(e) => setOffice({ ...office, email: e.target.value })}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Website</span>
          <input
            type="url"
            value={office.website ?? ""}
            onChange={(e) => setOffice({ ...office, website: e.target.value })}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {hasOffice ? "Save office" : "Create office"}
        </button>
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
              <input
                type="time"
                value={entry.opensAt ?? ""}
                disabled={entry.isClosed}
                onChange={(e) => {
                  const next = [...schedule];
                  next[i] = { ...next[i]!, opensAt: e.target.value || null };
                  setSchedule(next);
                }}
                className="rounded border border-neutral-300 px-2 py-1"
              />
              <input
                type="time"
                value={entry.closesAt ?? ""}
                disabled={entry.isClosed}
                onChange={(e) => {
                  const next = [...schedule];
                  next[i] = { ...next[i]!, closesAt: e.target.value || null };
                  setSchedule(next);
                }}
                className="rounded border border-neutral-300 px-2 py-1"
              />
              <input
                type="checkbox"
                checked={entry.isClosed}
                onChange={(e) => {
                  const next = [...schedule];
                  next[i] = { ...next[i]!, isClosed: e.target.checked };
                  setSchedule(next);
                }}
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={isPending || !hasOffice}
          className="self-start rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save schedule
        </button>
        {!hasOffice && (
          <span className="text-xs text-neutral-500">
            Create the office first to save a schedule.
          </span>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">FAQs</h2>
        <ul className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <li key={faq.id} className="rounded border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{faq.question}</p>
                  <p className="mt-1 text-sm text-neutral-600">{faq.answer}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteFaq(faq.id)}
                  className="text-xs text-red-700 underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={onAddFaq} className="flex flex-col gap-2">
          <input
            type="text"
            required
            placeholder="Question"
            value={newFaq.question}
            onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Answer"
            value={newFaq.answer}
            onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
            rows={2}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending || !hasOffice}
            className="self-start rounded border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add FAQ
          </button>
        </form>
      </section>
    </div>
  );
}

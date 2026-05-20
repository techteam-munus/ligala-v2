"use client";

import { useState, useTransition } from "react";
import {
  createReferralLink,
  deleteReferralLink,
  patchReferralLink,
} from "@/lib/actions/referral";

type Link = {
  id: string;
  slug: string;
  label: string | null;
  active: boolean;
  clicks: number;
  signups: number;
  createdAt: string;
};

export function LinksManager({ items, origin }: { items: Link[]; origin: string }) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(slug: string) {
    const url = `${origin}/cases/new?ref=${slug}`;
    navigator.clipboard?.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await createReferralLink({ label: label.trim() || undefined });
        setLabel("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function toggleActive(link: Link) {
    start(async () => {
      try {
        await patchReferralLink(link.id, { active: !link.active });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function remove(link: Link) {
    if (!confirm(`Delete link ${link.slug}? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteReferralLink(link.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div>
      <form onSubmit={create} className="mt-6 flex items-end gap-2 rounded border border-neutral-200 p-4">
        <label className="flex-1 text-sm">
          <span className="block font-medium">Label (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="LinkedIn bio"
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Creating…" : "New link"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Your links ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No links yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((l) => (
            <li key={l.id} className="rounded border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">{l.slug}</p>
                  {l.label ? (
                    <p className="text-xs text-neutral-500">{l.label}</p>
                  ) : null}
                  <p className="mt-1 truncate text-xs text-neutral-500">
                    {origin}/cases/new?ref={l.slug}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {l.clicks} clicks · {l.signups} signups · {l.active ? "active" : "disabled"}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => copy(l.slug)}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  >
                    {copied === l.slug ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(l)}
                    disabled={pending}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {l.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(l)}
                    disabled={pending}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

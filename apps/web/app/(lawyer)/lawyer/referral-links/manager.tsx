"use client";

import { useState, useTransition } from "react";
import {
  createReferralLink,
  deleteReferralLink,
  patchReferralLink,
} from "@/lib/actions/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="mt-6 gap-3 py-4">
        <CardContent className="px-4">
          <form onSubmit={create} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="link-label">Label (optional)</Label>
              <Input
                id="link-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="LinkedIn bio"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "New link"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Your links ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No links yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((l) => (
            <li key={l.id}>
              <Card className="gap-2 py-3">
                <CardContent className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-mono text-sm font-medium">
                        {l.slug}
                        <Badge variant={l.active ? "secondary" : "outline"}>
                          {l.active ? "active" : "disabled"}
                        </Badge>
                      </p>
                      {l.label ? (
                        <p className="text-xs text-muted-foreground">{l.label}</p>
                      ) : null}
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {origin}/cases/new?ref={l.slug}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {l.clicks} clicks · {l.signups} signups
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copy(l.slug)}
                      >
                        {copied === l.slug ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(l)}
                        disabled={pending}
                      >
                        {l.active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => remove(l)}
                        disabled={pending}
                        className="text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

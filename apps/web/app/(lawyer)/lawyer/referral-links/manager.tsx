"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Link2,
  Power,
  PowerOff,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  createReferralLink,
  deleteReferralLink,
  patchReferralLink,
} from "@/lib/actions/referral";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Link = {
  id: string;
  slug: string;
  label: string | null;
  active: boolean;
  clicks: number;
  signups: number;
  createdAt: string;
};

export function LinksManager({
  items,
  origin,
}: {
  items: Link[];
  origin: string;
}) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function urlFor(slug: string) {
    return `${origin}/cases/new?ref=${slug}`;
  }

  function copy(slug: string) {
    const url = urlFor(slug);
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
    <>
      {/* Links table ----------------------------------------------- */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Your links
            </p>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </div>
        </div>
        <CardContent className="px-0">
          {error ? (
            <p className="border-b border-border/60 px-4 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Link2 className="size-5" />
              </span>
              <p className="text-sm font-medium">No links yet</p>
              <p className="text-xs text-muted-foreground">
                Create your first link from the panel on the right.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((l) => (
                <li
                  key={l.id}
                  className={cn(
                    "px-4 py-3",
                    !l.active && "bg-muted/20",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium tracking-tight">
                          /{l.slug}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset",
                            l.active
                              ? "bg-background/40 text-emerald-700 ring-emerald-200/60 dark:text-emerald-300 dark:ring-emerald-900/40"
                              : "bg-background/40 text-muted-foreground ring-border/60",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              l.active ? "bg-emerald-500" : "bg-zinc-400",
                            )}
                            aria-hidden
                          />
                          {l.active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      {l.label ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {l.label}
                        </p>
                      ) : null}
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {urlFor(l.slug)}
                      </p>
                      <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                        <span>
                          <span className="font-medium text-foreground">
                            {l.clicks}
                          </span>{" "}
                          clicks
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>
                          <span className="font-medium text-foreground">
                            {l.signups}
                          </span>{" "}
                          signups
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={copied === l.slug ? "default" : "outline"}
                        onClick={() => copy(l.slug)}
                        className={cn(
                          copied === l.slug &&
                            "bg-emerald-600 text-white hover:bg-emerald-700",
                        )}
                      >
                        {copied === l.slug ? <Check /> : <Copy />}
                        {copied === l.slug ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(l)}
                        disabled={pending}
                        aria-label={l.active ? "Disable" : "Enable"}
                      >
                        {l.active ? <PowerOff /> : <Power />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(l)}
                        disabled={pending}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create form ----------------------------------------------- */}
      <aside>
        <Card size="sm" className="gap-3">
          <CardHeader className="flex-row items-center gap-2">
            <Sparkles className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              New link
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="link-label" className="text-xs">
                  Label · optional
                </Label>
                <Input
                  id="link-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="LinkedIn bio"
                />
                <p className="text-[11px] text-muted-foreground">
                  Just for your own records. Clients don&apos;t see it.
                </p>
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creating…" : "Generate link"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </aside>
    </>
  );
}

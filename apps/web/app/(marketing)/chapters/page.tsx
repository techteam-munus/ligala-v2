import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  Building2,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "IBP chapters · Ligala",
  description:
    "Integrated Bar of the Philippines chapters represented on Ligala. Browse verified lawyers by chapter.",
};

type Chapter = {
  id: string;
  name: string;
  region: string;
  city: string | null;
  memberCount: number;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function ChaptersIndexPage() {
  const { items } = await safe<{ items: Chapter[] }>("/directory/chapters", {
    items: [],
  });

  // Group by region (preserve API order within each group).
  const groups = new Map<string, Chapter[]>();
  for (const ch of items) {
    const region = ch.region || "Other";
    const list = groups.get(region) ?? [];
    list.push(ch);
    groups.set(region, list);
  }
  const regions = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  const totalMembers = items.reduce((s, c) => s + c.memberCount, 0);
  const activeChapters = items.filter((c) => c.memberCount > 0).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Hero ----------------------------------------------------------- */}
      <header className="border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Directory · IBP
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          IBP chapters
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Browse the Integrated Bar of the Philippines chapters with verified
          lawyers on Ligala. Pick a chapter to see its roster.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground/70" />
            <span className="font-medium tabular-nums text-foreground">
              {items.length.toLocaleString("en-PH")}
            </span>{" "}
            {items.length === 1 ? "chapter" : "chapters"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground/70" />
            <span className="font-medium tabular-nums text-foreground">
              {totalMembers.toLocaleString("en-PH")}
            </span>{" "}
            verified {totalMembers === 1 ? "lawyer" : "lawyers"}
          </span>
          {activeChapters !== items.length ? (
            <span className="tabular-nums">
              {activeChapters} active{" "}
              <span className="text-muted-foreground/60">
                · {items.length - activeChapters} empty
              </span>
            </span>
          ) : null}
        </div>
      </header>

      {/* Body ----------------------------------------------------------- */}
      {items.length === 0 ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Building2 className="size-5" />
            </span>
            <p className="text-sm font-medium">No chapters yet</p>
            <p className="text-xs text-muted-foreground">
              Chapter data loads from the directory feed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-8">
          {regions.map((region) => {
            const chapters = groups.get(region) ?? [];
            return (
              <section key={region}>
                <div className="mb-3 flex items-end justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {region}
                  </h2>
                  <span className="text-[11px] tabular-nums text-muted-foreground/70">
                    {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {chapters.map((ch) => (
                    <li key={ch.id}>
                      <Link
                        href={`/chapters/${ch.id}` as never}
                        className="group block"
                      >
                        <Card className="gap-0 py-0 transition-all group-hover:ring-foreground/30 group-hover:shadow-sm">
                          <CardContent className="flex h-full flex-col gap-3 px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-700 ring-1 ring-inset ring-sky-200/60 dark:text-sky-300 dark:ring-sky-900/40",
                                )}
                                aria-hidden
                              >
                                <Building2 className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold tracking-tight group-hover:underline">
                                  {ch.name}
                                </p>
                                {ch.city ? (
                                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <MapPin className="size-3" />
                                    {ch.city}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <Users className="size-3.5" />
                                <span className="font-medium tabular-nums text-foreground">
                                  {ch.memberCount}
                                </span>{" "}
                                verified
                              </span>
                              <span className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                Browse
                                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Bottom hint ---------------------------------------------------- */}
      {items.length > 0 ? (
        <Card
          size="sm"
          className="mt-10 gap-2 bg-gradient-to-br from-muted/30 to-transparent"
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                Looking for a lawyer instead of a chapter?
              </p>
              <p className="text-xs text-muted-foreground">
                Search the full directory by practice area, jurisdiction, and
                city.
              </p>
            </div>
            <Link
              href="/lawyers"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60"
            >
              <Search className="size-3.5" />
              Find a lawyer
              <ArrowUpRight className="size-3 opacity-60" />
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

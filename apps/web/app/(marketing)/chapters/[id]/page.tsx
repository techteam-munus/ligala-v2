import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  HeartHandshake,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Chapter = {
  id: string;
  name: string;
  region: string;
  city: string | null;
};

type Member = {
  slug: string;
  name: string;
  bio: string | null;
  probonoAvailable: boolean;
};

type ChapterResponse = { chapter: Chapter; members: Member[] };

async function load(id: string): Promise<ChapterResponse | null> {
  try {
    return await api<ChapterResponse>(`/directory/chapters/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: "Chapter not found · Ligala" };
  return {
    title: `${data.chapter.name} · Ligala`,
    description: `Verified Ligala lawyers in the ${data.chapter.name} (${data.chapter.region}).`,
  };
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function tintFor(slug: string): { bg: string; text: string; ring: string } {
  const palette = [
    {
      bg: "bg-sky-500/15",
      text: "text-sky-700 dark:text-sky-300",
      ring: "ring-sky-200/60 dark:ring-sky-900/40",
    },
    {
      bg: "bg-emerald-500/15",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
    },
    {
      bg: "bg-violet-500/15",
      text: "text-violet-700 dark:text-violet-300",
      ring: "ring-violet-200/60 dark:ring-violet-900/40",
    },
    {
      bg: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-200/60 dark:ring-amber-900/40",
    },
    {
      bg: "bg-rose-500/15",
      text: "text-rose-700 dark:text-rose-300",
      ring: "ring-rose-200/60 dark:ring-rose-900/40",
    },
  ] as const;
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length]!;
}

export default async function ChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  const probonoCount = data.members.filter((m) => m.probonoAvailable).length;
  const location = [data.chapter.city, data.chapter.region]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href="/chapters"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All chapters
      </Link>

      {/* Hero ----------------------------------------------------------- */}
      <header className="mt-3 border-b border-border/60 pb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 ring-1 ring-inset ring-sky-200/60 dark:text-sky-300 dark:ring-sky-900/40"
              aria-hidden
            >
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                IBP Chapter
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
                {data.chapter.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground/70" />
                    {location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted-foreground/70" />
                  <span className="font-medium tabular-nums text-foreground">
                    {data.members.length}
                  </span>{" "}
                  verified{" "}
                  {data.members.length === 1 ? "member" : "members"}
                </span>
                {probonoCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
                    <HeartHandshake className="size-3.5" />
                    <span className="font-medium tabular-nums">
                      {probonoCount}
                    </span>{" "}
                    pro bono
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Button asChild size="lg">
            <Link href={`/lawyers?chapterId=${data.chapter.id}` as never}>
              <Search />
              Search lawyers in this chapter
            </Link>
          </Button>
        </div>
      </header>

      {/* Members -------------------------------------------------------- */}
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Members
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {data.members.length}{" "}
            {data.members.length === 1 ? "lawyer" : "lawyers"}
          </span>
        </div>

        {data.members.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-5" />
              </span>
              <p className="text-sm font-medium">No members listed yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                No verified lawyers from this chapter have joined Ligala yet.
                Check the full directory for nearby options.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/lawyers">Browse all lawyers</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.members.map((m) => (
              <MemberCard key={m.slug} member={m} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MemberCard({ member }: { member: Member }) {
  const tint = tintFor(member.slug);
  return (
    <li>
      <Link href={`/lawyers/${member.slug}` as never} className="group block">
        <Card className="gap-0 py-0 transition-all group-hover:ring-foreground/30 group-hover:shadow-sm">
          <CardContent className="flex items-start gap-4 px-4 py-4">
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset",
                tint.bg,
                tint.text,
                tint.ring,
              )}
              aria-hidden
            >
              {initialsOf(member.name) || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold tracking-tight group-hover:underline">
                  {member.name}
                </p>
                {member.probonoAvailable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200/60 dark:text-violet-300 dark:ring-violet-900/40">
                    <HeartHandshake className="size-3" />
                    Pro bono
                  </span>
                ) : null}
              </div>
              {member.bio ? (
                <p className="mt-1.5 line-clamp-2 text-xs text-foreground/80">
                  {member.bio}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground/70">
                  No bio listed.
                </p>
              )}
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                View profile
                <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}

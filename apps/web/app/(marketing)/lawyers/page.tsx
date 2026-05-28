import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  MapPin,
  Scale,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Find a lawyer · Ligala",
  description:
    "Browse verified Philippine lawyers by practice area, jurisdiction, and city. KYC-verified profiles only.",
};

type Item = {
  slug: string;
  name: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  verified: boolean;
  probonoAvailable: boolean;
  photoUrl: string | null;
  practiceAreas: { id: string; name: string }[];
};

type SearchResponse = {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
};

type Ref = { id: string; name: string };
type RefList = { items: Ref[] };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.length > 0) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic avatar tint per slug — keeps a lawyer's chip colour stable
// across page loads without depending on a hash library.
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

export default async function LawyersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const q = pick("q") ?? "";
  const practiceAreaId = pick("practiceAreaId") ?? "";
  const jurisdictionId = pick("jurisdictionId") ?? "";
  const city = pick("city") ?? "";
  const probono = pick("probono") === "true" ? "true" : "";
  const chapterId = pick("chapterId") ?? "";
  const page = Number.parseInt(pick("page") ?? "1", 10) || 1;
  const pageSize = 20;

  const query = qs({
    q,
    practiceAreaId,
    jurisdictionId,
    city,
    probono,
    chapterId,
    page: String(page),
    pageSize: String(pageSize),
  });

  const [results, practice, jurisdictions, chapters] = await Promise.all([
    safe<SearchResponse>(`/directory/lawyers${query}`, {
      items: [],
      total: 0,
      page,
      pageSize,
    }),
    safe<RefList>("/references/practice-areas", { items: [] }),
    safe<RefList>("/references/jurisdictions", { items: [] }),
    safe<RefList>("/references/ibp-chapters", { items: [] }),
  ]);

  const practiceById = new Map(practice.items.map((p) => [p.id, p.name]));
  const jurisdictionById = new Map(
    jurisdictions.items.map((j) => [j.id, j.name]),
  );
  const chapterById = new Map(chapters.items.map((c) => [c.id, c.name]));

  const totalPages = Math.max(1, Math.ceil(results.total / pageSize));
  const pageStart = results.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(results.total, pageStart + results.items.length - 1);

  function pageHref(targetPage: number): string {
    return `/lawyers${qs({
      q,
      practiceAreaId,
      jurisdictionId,
      city,
      probono,
      chapterId,
      page: targetPage > 1 ? String(targetPage) : undefined,
    })}`;
  }

  function removeHref(key: string): string {
    const params: Record<string, string | undefined> = {
      q,
      practiceAreaId,
      jurisdictionId,
      city,
      probono,
      chapterId,
    };
    params[key] = undefined;
    return `/lawyers${qs(params)}`;
  }

  const activeFilters: { key: string; label: string; value: string }[] = [];
  if (q) activeFilters.push({ key: "q", label: "Query", value: q });
  if (practiceAreaId) {
    activeFilters.push({
      key: "practiceAreaId",
      label: "Practice",
      value: practiceById.get(practiceAreaId) ?? practiceAreaId,
    });
  }
  if (jurisdictionId) {
    activeFilters.push({
      key: "jurisdictionId",
      label: "Jurisdiction",
      value: jurisdictionById.get(jurisdictionId) ?? jurisdictionId,
    });
  }
  if (city) activeFilters.push({ key: "city", label: "City", value: city });
  if (chapterId) {
    activeFilters.push({
      key: "chapterId",
      label: "Chapter",
      value: chapterById.get(chapterId) ?? chapterId,
    });
  }
  if (probono === "true") {
    activeFilters.push({ key: "probono", label: "Filter", value: "Pro bono" });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Hero --------------------------------------------------------- */}
      <header className="border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Directory
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Find a lawyer.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Every profile is KYC-verified — government ID, bar certificate, and
          selfie. Filter by practice area, jurisdiction, and city.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium tabular-nums text-foreground">
              {results.total.toLocaleString("en-PH")}
            </span>{" "}
            verified {results.total === 1 ? "lawyer" : "lawyers"}
          </span>
          {results.total > 0 ? (
            <span className="tabular-nums">
              Showing {pageStart}–{pageEnd}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] [&>*]:min-w-0">
        {/* Filter sidebar -------------------------------------------- */}
        <aside className="lg:self-start">
          <Card size="sm" className="gap-3">
            <CardContent>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Refine
              </p>
              <form className="mt-3 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="q" className="text-xs">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="q"
                      name="q"
                      defaultValue={q}
                      placeholder="Name or bio…"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="practiceAreaId" className="text-xs">
                    <Scale className="mr-1 inline size-3" />
                    Practice area
                  </Label>
                  <select
                    id="practiceAreaId"
                    name="practiceAreaId"
                    defaultValue={practiceAreaId}
                    className={SELECT_CLASS}
                  >
                    <option value="">All practice areas</option>
                    {practice.items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="jurisdictionId" className="text-xs">
                    Jurisdiction
                  </Label>
                  <select
                    id="jurisdictionId"
                    name="jurisdictionId"
                    defaultValue={jurisdictionId}
                    className={SELECT_CLASS}
                  >
                    <option value="">All jurisdictions</option>
                    {jurisdictions.items.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs">
                    <MapPin className="mr-1 inline size-3" />
                    City
                  </Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={city}
                    placeholder="e.g. Makati"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="chapterId" className="text-xs">
                    <Building2 className="mr-1 inline size-3" />
                    IBP chapter
                  </Label>
                  <select
                    id="chapterId"
                    name="chapterId"
                    defaultValue={chapterId}
                    className={SELECT_CLASS}
                  >
                    <option value="">All chapters</option>
                    {chapters.items.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors cursor-pointer",
                    probono === "true" &&
                      "border-transparent bg-violet-500/10 text-violet-700 ring-1 ring-inset ring-violet-200/60 dark:text-violet-300 dark:ring-violet-900/40",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <HeartHandshake className="size-3.5" />
                    Accepts pro bono
                  </span>
                  <input
                    type="checkbox"
                    name="probono"
                    value="true"
                    defaultChecked={probono === "true"}
                    className="size-4 rounded border-input accent-violet-600"
                  />
                </label>

                <div className="space-y-2 pt-2">
                  <Button type="submit" className="w-full">
                    <Search />
                    Search
                  </Button>
                  {activeFilters.length > 0 ? (
                    <Button
                      asChild
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    >
                      <Link href="/lawyers">Reset filters</Link>
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>
        </aside>

        {/* Results --------------------------------------------------- */}
        <section className="space-y-4">
          {/* Active filter chip row */}
          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Filtering by
              </span>
              {activeFilters.map((f) => (
                <Link
                  key={f.key}
                  href={removeHref(f.key) as never}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted/60"
                >
                  <span className="text-muted-foreground">{f.label}:</span>
                  <span>{f.value}</span>
                  <X className="size-3 text-muted-foreground/60 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          ) : null}

          {/* Lawyer cards */}
          {results.items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Search className="size-5" />
                </span>
                <p className="text-sm font-medium">No lawyers match</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Try widening your search — remove a filter or two from the
                  panel on the left.
                </p>
                {activeFilters.length > 0 ? (
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href="/lawyers">Reset filters</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {results.items.map((l) => (
                <LawyerCard key={l.slug} item={l} />
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground"
              aria-label="Pagination"
            >
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                {page <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft />
                    Prev
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(page - 1) as never}>
                      <ChevronLeft />
                      Prev
                    </Link>
                  </Button>
                )}
                {page >= totalPages ? (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight />
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(page + 1) as never}>
                      Next
                      <ChevronRight />
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function LawyerCard({ item }: { item: Item }) {
  const tint = tintFor(item.slug);
  const location = [item.city, item.region].filter(Boolean).join(", ");
  const extra = item.practiceAreas.length - 4;

  return (
    <li>
      <Link href={`/lawyers/${item.slug}` as never} className="group block">
        <Card className="gap-0 py-0 transition-all group-hover:ring-foreground/30 group-hover:shadow-sm">
          <CardContent className="flex items-start gap-4 px-5 py-5">
            {/* Avatar */}
            {item.photoUrl ? (
              // Plain <img>, not next/image: presigned S3 URLs rotate hosts/
              // query params, which next/image's remotePatterns can't allow.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photoUrl}
                alt=""
                className="size-12 shrink-0 rounded-full object-cover ring-1 ring-inset ring-border"
              />
            ) : (
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold ring-1 ring-inset",
                  tint.bg,
                  tint.text,
                  tint.ring,
                )}
                aria-hidden
              >
                {initialsOf(item.name) || "?"}
              </span>
            )}

            {/* Body */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium tracking-tight group-hover:underline">
                    {item.name}
                  </p>
                  {location ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {location}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:text-emerald-300 dark:ring-emerald-900/40">
                      <ShieldCheck className="size-3" />
                      Verified
                    </span>
                  ) : null}
                  {item.probonoAvailable ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200/60 dark:text-violet-300 dark:ring-violet-900/40">
                      <HeartHandshake className="size-3" />
                      Pro bono
                    </span>
                  ) : null}
                </div>
              </div>

              {item.bio ? (
                <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
                  {item.bio}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {item.practiceAreas.slice(0, 4).map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center rounded-full border border-border/60 bg-card px-2 py-0.5 text-[11px] font-medium text-foreground"
                    >
                      {p.name}
                    </span>
                  ))}
                  {extra > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      +{extra} more
                    </span>
                  ) : null}
                  {item.practiceAreas.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground/70">
                      No practice areas listed
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  View profile
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}

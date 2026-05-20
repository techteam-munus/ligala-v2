import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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

  const totalPages = Math.max(1, Math.ceil(results.total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Find a lawyer</h1>
      <p className="mt-2 text-muted-foreground">
        {results.total} verified {results.total === 1 ? "lawyer" : "lawyers"} on Ligala.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
        <aside>
          <Card>
            <CardContent className="px-4">
              <form className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="q">Name or bio</Label>
                  <Input id="q" name="q" defaultValue={q} placeholder="e.g. Cruz" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="practiceAreaId">Practice area</Label>
                  <select
                    id="practiceAreaId"
                    name="practiceAreaId"
                    defaultValue={practiceAreaId}
                    className={SELECT_CLASS}
                  >
                    <option value="">All</option>
                    {practice.items.map((p) => (
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
                    name="jurisdictionId"
                    defaultValue={jurisdictionId}
                    className={SELECT_CLASS}
                  >
                    <option value="">All</option>
                    {jurisdictions.items.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" defaultValue={city} placeholder="e.g. Makati" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="chapterId">IBP chapter</Label>
                  <select
                    id="chapterId"
                    name="chapterId"
                    defaultValue={chapterId}
                    className={SELECT_CLASS}
                  >
                    <option value="">All</option>
                    {chapters.items.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="probono"
                    value="true"
                    defaultChecked={probono === "true"}
                    className="h-4 w-4 rounded border-input"
                  />
                  Accepts pro bono
                </label>
                <Button type="submit" className="w-full">
                  Search
                </Button>
                <Link
                  href="/lawyers"
                  className="block text-center text-xs text-muted-foreground underline"
                >
                  Reset
                </Link>
              </form>
            </CardContent>
          </Card>
        </aside>

        <section>
          {results.items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No lawyers match these filters yet.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {results.items.map((l) => (
                <li key={l.slug}>
                  <Card className="gap-2 py-4 transition-colors hover:border-foreground/40">
                    <CardContent className="px-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <Link
                            href={`/lawyers/${l.slug}` as never}
                            className="text-lg font-medium hover:underline"
                          >
                            {l.name}
                          </Link>
                          {l.city || l.region ? (
                            <p className="text-sm text-muted-foreground">
                              {[l.city, l.region].filter(Boolean).join(", ")}
                            </p>
                          ) : null}
                          {l.bio ? (
                            <p className="mt-2 line-clamp-2 text-sm">{l.bio}</p>
                          ) : null}
                          {l.practiceAreas.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {l.practiceAreas.slice(0, 4).map((p) => (
                                <Badge key={p.id} variant="secondary">
                                  {p.name}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {l.verified ? (
                            <Badge variant="outline" className="border-green-600 text-green-700">
                              Verified
                            </Badge>
                          ) : null}
                          {l.probonoAvailable ? (
                            <Badge variant="outline" className="border-amber-600 text-amber-700">
                              Pro bono
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-between text-sm">
              <Button asChild variant="ghost" size="sm" disabled={page <= 1}>
                <Link
                  href={`/lawyers${qs({ q, practiceAreaId, jurisdictionId, city, probono, chapterId, page: String(Math.max(1, page - 1)) })}` as never}
                >
                  ← Previous
                </Link>
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button asChild variant="ghost" size="sm" disabled={page >= totalPages}>
                <Link
                  href={`/lawyers${qs({ q, practiceAreaId, jurisdictionId, city, probono, chapterId, page: String(Math.min(totalPages, page + 1)) })}` as never}
                >
                  Next →
                </Link>
              </Button>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}

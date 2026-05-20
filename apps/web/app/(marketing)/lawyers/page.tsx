import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api";

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
  const page = Number.parseInt(pick("page") ?? "1", 10) || 1;
  const pageSize = 20;

  const query = qs({
    q,
    practiceAreaId,
    jurisdictionId,
    city,
    page: String(page),
    pageSize: String(pageSize),
  });

  const [results, practice, jurisdictions] = await Promise.all([
    safe<SearchResponse>(`/directory/lawyers${query}`, {
      items: [],
      total: 0,
      page,
      pageSize,
    }),
    safe<RefList>("/references/practice-areas", { items: [] }),
    safe<RefList>("/references/jurisdictions", { items: [] }),
  ]);

  const totalPages = Math.max(1, Math.ceil(results.total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Find a lawyer</h1>
      <p className="mt-2 text-neutral-600">
        {results.total} verified {results.total === 1 ? "lawyer" : "lawyers"} on Ligala.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
        <aside>
          <form className="space-y-4 rounded border border-neutral-200 p-4">
            <div>
              <label htmlFor="q" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
                Name or bio
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="e.g. Cruz"
              />
            </div>
            <div>
              <label htmlFor="practiceAreaId" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
                Practice area
              </label>
              <select
                id="practiceAreaId"
                name="practiceAreaId"
                defaultValue={practiceAreaId}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {practice.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="jurisdictionId" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
                Jurisdiction
              </label>
              <select
                id="jurisdictionId"
                name="jurisdictionId"
                defaultValue={jurisdictionId}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {jurisdictions.items.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="city" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
                City
              </label>
              <input
                id="city"
                name="city"
                defaultValue={city}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="e.g. Makati"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
            >
              Search
            </button>
            <Link
              href="/lawyers"
              className="block text-center text-xs text-neutral-500 underline"
            >
              Reset
            </Link>
          </form>
        </aside>

        <section>
          {results.items.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
              No lawyers match these filters yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {results.items.map((l) => (
                <li
                  key={l.slug}
                  className="rounded border border-neutral-200 p-4 hover:border-neutral-400"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        href={`/lawyers/${l.slug}` as never}
                        className="text-lg font-medium hover:underline"
                      >
                        {l.name}
                      </Link>
                      {l.city || l.region ? (
                        <p className="text-sm text-neutral-500">
                          {[l.city, l.region].filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                      {l.bio ? (
                        <p className="mt-2 line-clamp-2 text-sm text-neutral-700">{l.bio}</p>
                      ) : null}
                      {l.practiceAreas.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {l.practiceAreas.slice(0, 4).map((p) => (
                            <span
                              key={p.id}
                              className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {l.verified ? (
                      <span className="shrink-0 rounded-full border border-green-600 px-2 py-0.5 text-xs font-medium text-green-700">
                        Verified
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-between text-sm">
              <Link
                href={`/lawyers${qs({ q, practiceAreaId, jurisdictionId, city, page: String(Math.max(1, page - 1)) })}` as never}
                className={page <= 1 ? "pointer-events-none text-neutral-300" : "text-neutral-700 underline"}
              >
                ← Previous
              </Link>
              <span className="text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <Link
                href={`/lawyers${qs({ q, practiceAreaId, jurisdictionId, city, page: String(Math.min(totalPages, page + 1)) })}` as never}
                className={page >= totalPages ? "pointer-events-none text-neutral-300" : "text-neutral-700 underline"}
              >
                Next →
              </Link>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}

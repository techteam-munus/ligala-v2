import Link from "next/link";
import { api } from "@/lib/api";

type CaseRow = {
  id: string;
  title: string;
  type: "paid" | "probono";
  status: string;
  updatedAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function ClientCasesPage() {
  const { items } = await safe<{ items: CaseRow[] }>("/cases", { items: [] });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Your cases</h1>
        <Link href="/lawyers" className="text-sm text-neutral-700 underline">
          Find a lawyer →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          You haven&apos;t opened any cases yet. Browse the directory to engage a lawyer.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}` as never}
                className="block rounded border border-neutral-200 p-4 hover:border-neutral-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                      {c.type} · {c.status}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

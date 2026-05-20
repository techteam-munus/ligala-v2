import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

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
        <Link href="/lawyers" className="text-sm underline">
          Find a lawyer →
        </Link>
      </div>

      {items.length === 0 ? (
        <Card className="mt-8 border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            You haven&apos;t opened any cases yet. Browse the directory to engage a lawyer.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/cases/${c.id}` as never} className="block">
                <Card className="gap-2 py-4 transition-colors hover:border-foreground/40">
                  <CardContent className="px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                          {c.type} · {c.status}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

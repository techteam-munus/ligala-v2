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

export default async function LawyerCasesPage() {
  const { items } = await safe<{ items: CaseRow[] }>("/cases", { items: [] });

  const pending = items.filter((c) => c.status === "pending");
  const open = items.filter((c) => ["accepted", "active"].includes(c.status));
  const closed = items.filter((c) =>
    ["closed", "cancelled", "declined"].includes(c.status),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>

      <Bucket title="Awaiting your decision" items={pending} emptyHint="No new requests right now." />
      <Bucket title="Open" items={open} emptyHint="Nothing in progress." />
      <Bucket title="Closed / declined" items={closed} emptyHint="No history yet." />
    </main>
  );
}

function Bucket({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: CaseRow[];
  emptyHint: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/lawyer/cases/${c.id}` as never} className="block">
                <Card className="gap-0 py-3 transition-colors hover:border-foreground/40">
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
    </section>
  );
}

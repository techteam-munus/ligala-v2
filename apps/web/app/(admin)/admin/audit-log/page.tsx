import { api } from "@/lib/api";

type Row = {
  log: {
    id: string;
    action: string;
    subjectType: string;
    subjectId: string;
    reason: string | null;
    payload: Record<string, unknown> | null;
    createdAt: string;
  };
  actorName: string;
  actorEmail: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function AdminAuditLogPage() {
  const { items } = await safe<{ items: Row[] }>("/admin/audit-log", { items: [] });
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-2 text-neutral-600">
        Most recent 100 admin actions. Append-only — every status change, role
        change, KYC decision, refund, and discount removal lands here.
      </p>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No admin actions yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((r) => (
            <li key={r.log.id} className="rounded border border-neutral-200 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.log.action}</p>
                  <p className="text-xs text-neutral-500">
                    by {r.actorName} ({r.actorEmail}) ·{" "}
                    {r.log.subjectType}:{r.log.subjectId.slice(0, 8)}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  {new Date(r.log.createdAt).toLocaleString()}
                </p>
              </div>
              {r.log.reason ? (
                <p className="mt-1 text-xs text-neutral-700">{r.log.reason}</p>
              ) : null}
              {r.log.payload ? (
                <pre className="mt-1 overflow-x-auto text-[10px] text-neutral-500">
                  {JSON.stringify(r.log.payload, null, 0)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

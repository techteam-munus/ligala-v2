import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <p className="mt-2 text-muted-foreground">
        Most recent 100 admin actions. Append-only — every status change, role
        change, KYC decision, refund, and discount removal lands here.
      </p>
      {items.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No admin actions yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((r) => (
            <li key={r.log.id}>
              <Card className="gap-2 py-3">
                <CardHeader className="px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">{r.log.action}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        by {r.actorName} ({r.actorEmail}) · {r.log.subjectType}:
                        <span className="font-mono">{r.log.subjectId.slice(0, 8)}</span>
                      </CardDescription>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {new Date(r.log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </CardHeader>
                {r.log.reason || r.log.payload ? (
                  <CardContent className="px-4">
                    {r.log.reason ? (
                      <p className="text-xs">{r.log.reason}</p>
                    ) : null}
                    {r.log.payload ? (
                      <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">
                        {JSON.stringify(r.log.payload, null, 0)}
                      </pre>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

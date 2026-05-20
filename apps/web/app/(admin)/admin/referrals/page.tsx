import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Referral = {
  id: string;
  kind: "case_referral" | "link_signup";
  fromLawyerId: string;
  toLawyerId: string;
  status: "pending" | "accepted" | "declined" | "completed";
  caseId: string | null;
  linkId: string | null;
  createdAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function statusVariant(status: Referral["status"]) {
  if (status === "completed" || status === "accepted") return "default" as const;
  if (status === "declined") return "destructive" as const;
  return "secondary" as const;
}

export default async function AdminReferralsPage() {
  const { items } = await safe<{ items: Referral[] }>("/admin/referrals", { items: [] });
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Referrals</h1>
      <p className="mt-2 text-muted-foreground">
        Read-only graph (most recent 200). Forced re-decisions live on the individual
        case detail page if needed.
      </p>
      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          <ul className="divide-y">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{r.kind}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {r.fromLawyerId.slice(0, 6)} → {r.toLawyerId.slice(0, 6)}
                    {r.caseId ? ` · case ${r.caseId.slice(0, 8)}` : ""}
                  </p>
                </div>
                <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No referrals yet.
              </li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

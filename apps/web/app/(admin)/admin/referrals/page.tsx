import { api } from "@/lib/api";

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

export default async function AdminReferralsPage() {
  const { items } = await safe<{ items: Referral[] }>("/admin/referrals", { items: [] });
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Referrals</h1>
      <p className="mt-2 text-neutral-600">
        Read-only graph (most recent 200). Forced re-decisions live on the individual
        case detail page if needed.
      </p>
      <ul className="mt-6 divide-y divide-neutral-200 rounded border border-neutral-200 text-sm">
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="font-medium">{r.kind}</p>
              <p className="text-xs text-neutral-500 font-mono">
                {r.fromLawyerId.slice(0, 6)} → {r.toLawyerId.slice(0, 6)}
                {r.caseId ? ` · case ${r.caseId.slice(0, 8)}` : ""}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                r.status === "completed" || r.status === "accepted"
                  ? "border-green-600 text-green-700"
                  : r.status === "declined"
                    ? "border-red-500 text-red-700"
                    : "border-amber-600 text-amber-700"
              }`}
            >
              {r.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

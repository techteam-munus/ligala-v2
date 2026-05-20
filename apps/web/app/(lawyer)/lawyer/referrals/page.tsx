import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { ReferralsList } from "./list";
import { OutboundForm } from "./outbound-form";

type Referral = {
  id: string;
  kind: "case_referral" | "link_signup";
  fromLawyerId: string;
  toLawyerId: string;
  caseId: string | null;
  linkId: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  noteMd: string | null;
  declineReason: string | null;
  decidedAt: string | null;
  createdAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function LawyerReferralsPage() {
  const session = await getSession();
  const meId = session?.user.id ?? "";
  const { items } = await safe<{ items: Referral[] }>("/referrals", { items: [] });

  const outbound = items.filter((r) => r.fromLawyerId === meId);
  const inbound = items.filter((r) => r.toLawyerId === meId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Referrals</h1>
      <p className="mt-2 text-muted-foreground">
        Hand cases off to another lawyer (conflict of interest, capacity,
        specialty). Also see signups attributed via your referral links.
      </p>

      <OutboundForm />

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Inbound ({inbound.length})
        </h2>
        <ReferralsList items={inbound} side="inbound" meId={meId} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Outbound ({outbound.length})
        </h2>
        <ReferralsList items={outbound} side="outbound" meId={meId} />
      </section>
    </main>
  );
}

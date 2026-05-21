import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { ReferralsList } from "./list";
import { OutboundForm, type CaseOption, type LawyerOption } from "./outbound-form";

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

type DirectoryLawyer = {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
};

type MyProfile = { profile: { slug: string } };
type CaseRow = { id: string; title: string; status: string; type: string };

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

  const [{ items }, directory, myProfile, myCases] = await Promise.all([
    safe<{ items: Referral[] }>("/referrals", { items: [] }),
    safe<{ items: DirectoryLawyer[] }>("/directory/lawyers?pageSize=100", { items: [] }),
    safe<MyProfile | null>("/lawyers/profile", null),
    safe<{ items: CaseRow[] }>("/cases", { items: [] }),
  ]);

  const mySlug = myProfile?.profile.slug ?? null;
  const lawyerOptions: LawyerOption[] = directory.items
    .filter((l) => l.slug !== mySlug)
    .map((l) => ({
      slug: l.slug,
      name: l.name,
      location: [l.city, l.region].filter(Boolean).join(", ") || null,
    }));
  const caseOptions: CaseOption[] = myCases.items.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
  }));

  const outbound = items.filter((r) => r.fromLawyerId === meId);
  const inbound = items.filter((r) => r.toLawyerId === meId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Referrals</h1>
      <p className="mt-2 text-muted-foreground">
        Hand cases off to another lawyer (conflict of interest, capacity,
        specialty). Also see signups attributed via your referral links.
      </p>

      <OutboundForm lawyers={lawyerOptions} cases={caseOptions} />

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

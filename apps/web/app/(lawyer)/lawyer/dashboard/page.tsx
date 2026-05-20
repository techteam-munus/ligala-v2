import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";

type CaseRow = { id: string; status: string };
type ReferralRow = {
  id: string;
  status: string;
  toLawyerId: string;
  fromLawyerId: string;
};
type LinkRow = { id: string; signups: number };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function LawyerDashboard() {
  const session = await getSession();
  const meId = session?.user.id ?? "";
  const [{ items: caseItems }, { items: referralItems }, { items: linkItems }] =
    await Promise.all([
      safe<{ items: CaseRow[] }>("/cases", { items: [] }),
      safe<{ items: ReferralRow[] }>("/referrals", { items: [] }),
      safe<{ items: LinkRow[] }>("/referrals/links", { items: [] }),
    ]);
  const pending = caseItems.filter((c) => c.status === "pending").length;
  const active = caseItems.filter((c) => c.status === "active").length;
  const inboundPending = referralItems.filter(
    (r) => r.status === "pending" && r.toLawyerId === meId,
  ).length;
  const linkSignups = linkItems.reduce((acc, l) => acc + l.signups, 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lawyer dashboard</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as <strong>{session?.user.email}</strong>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/lawyer/cases" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Cases</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {pending} awaiting · {active} active
          </p>
        </Link>
        <Link href="/lawyer/invoices" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Invoices</h2>
          <p className="mt-1 text-sm text-neutral-600">Bills, payments, ledger.</p>
        </Link>
        <Link href="/lawyer/referrals" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Referrals</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {inboundPending} inbound pending
          </p>
        </Link>
        <Link href="/lawyer/referral-links" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Referral links</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {linkItems.length} link{linkItems.length === 1 ? "" : "s"} · {linkSignups} signups
          </p>
        </Link>
        <Link href="/lawyer/profile" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Public profile</h2>
          <p className="mt-1 text-sm text-neutral-600">Bio, pro bono, practice areas.</p>
        </Link>
        <Link href="/lawyer/office" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Office</h2>
          <p className="mt-1 text-sm text-neutral-600">Address, schedule, FAQs.</p>
        </Link>
      </div>
    </main>
  );
}

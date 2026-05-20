import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

  const tiles = [
    { href: "/lawyer/cases", title: "Cases", sub: `${pending} awaiting · ${active} active` },
    { href: "/lawyer/invoices", title: "Invoices", sub: "Bills, payments, ledger." },
    { href: "/lawyer/referrals", title: "Referrals", sub: `${inboundPending} inbound pending` },
    {
      href: "/lawyer/referral-links",
      title: "Referral links",
      sub: `${linkItems.length} link${linkItems.length === 1 ? "" : "s"} · ${linkSignups} signups`,
    },
    { href: "/lawyer/profile", title: "Public profile", sub: "Bio, pro bono, practice areas." },
    { href: "/lawyer/office", title: "Office", sub: "Address, schedule, FAQs." },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lawyer dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as <strong>{session?.user.email}</strong>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href as never} className="block">
            <Card className="gap-2 py-4 transition-colors hover:border-foreground/40">
              <CardHeader className="px-4">
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.sub}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}

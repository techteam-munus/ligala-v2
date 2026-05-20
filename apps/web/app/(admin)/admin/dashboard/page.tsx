import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";

type Stats = {
  users: { role: string; status: string; count: number }[];
  kycPendingCount: number;
  invoicesPaidCount: number;
  refundsAllTime: number;
  activeReferrals: number;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function AdminDashboard() {
  const session = await getSession();
  const stats = await safe<Stats>("/admin/stats", {
    users: [],
    kycPendingCount: 0,
    invoicesPaidCount: 0,
    refundsAllTime: 0,
    activeReferrals: 0,
  });

  const total = stats.users.reduce((a, u) => a + u.count, 0);
  const byRole = (role: string) =>
    stats.users.filter((u) => u.role === role).reduce((a, u) => a + u.count, 0);
  const byStatus = (status: string) =>
    stats.users.filter((u) => u.status === status).reduce((a, u) => a + u.count, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as <strong>{session?.user.email}</strong>.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total users" value={total} />
        <Stat label="Lawyers" value={byRole("lawyer")} />
        <Stat label="Clients" value={byRole("client")} />
        <Stat label="Paused / banned" value={byStatus("paused") + byStatus("banned")} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/admin/users" title="Users" sub={`${total} total`} />
        <Tile
          href="/admin/kyc"
          title="KYC inbox"
          sub={`${stats.kycPendingCount} pending`}
          accent={stats.kycPendingCount > 0}
        />
        <Tile href="/admin/discount-codes" title="Discount codes" sub="Moderation" />
        <Tile
          href="/admin/invoices"
          title="Invoices"
          sub={`${stats.invoicesPaidCount} paid · ${stats.refundsAllTime} refunds`}
        />
        <Tile
          href="/admin/referrals"
          title="Referrals"
          sub={`${stats.activeReferrals} pending`}
        />
        <Tile href="/admin/audit-log" title="Audit log" sub="Recent admin actions" />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-neutral-200 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Tile({
  href,
  title,
  sub,
  accent = false,
}: {
  href: string;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href as never}
      className={`rounded border p-4 hover:border-neutral-500 ${
        accent ? "border-amber-400 bg-amber-50" : "border-neutral-300"
      }`}
    >
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{sub}</p>
    </Link>
  );
}

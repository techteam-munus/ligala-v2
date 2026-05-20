import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";

type CaseRow = { id: string; status: string };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function LawyerDashboard() {
  const session = await getSession();
  const { items } = await safe<{ items: CaseRow[] }>("/cases", { items: [] });
  const pending = items.filter((c) => c.status === "pending").length;
  const active = items.filter((c) => c.status === "active").length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lawyer dashboard</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as <strong>{session?.user.email}</strong>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <Link href="/lawyer/profile" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Public profile</h2>
          <p className="mt-1 text-sm text-neutral-600">Bio, practice areas, jurisdictions.</p>
        </Link>
        <Link href="/lawyer/office" className="rounded border border-neutral-300 p-4 hover:border-neutral-500">
          <h2 className="font-medium">Office</h2>
          <p className="mt-1 text-sm text-neutral-600">Address, schedule, FAQs.</p>
        </Link>
      </div>

      <p className="mt-8 text-sm text-neutral-500">
        Phase 6 adds referrals + pro bono polish.
      </p>
    </main>
  );
}

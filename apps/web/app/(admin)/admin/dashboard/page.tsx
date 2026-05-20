import { getSession } from "@/lib/session";

export default async function AdminDashboard() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as <strong>{session?.user.email}</strong>.
      </p>
      <p className="mt-6 text-sm text-neutral-500">
        Phase 7 fills this with account oversight, verification approvals, and
        discount code management.
      </p>
    </main>
  );
}

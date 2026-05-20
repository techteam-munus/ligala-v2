import { getSession } from "@/lib/session";

export default async function ClientDashboard() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as <strong>{session?.user.email}</strong> (role:{" "}
        <code>{session?.user.role}</code>).
      </p>
      <p className="mt-6 text-sm text-neutral-500">
        Phase 3 fills this dashboard with lawyer search, your cases, and account
        actions.
      </p>
    </main>
  );
}

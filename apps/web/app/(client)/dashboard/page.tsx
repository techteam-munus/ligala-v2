import Link from "next/link";
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

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/lawyers"
          className="rounded border border-neutral-300 p-4 hover:border-neutral-500"
        >
          <h2 className="font-medium">Find a lawyer</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Browse verified Philippine lawyers by practice area, jurisdiction, and city.
          </p>
        </Link>
        <Link
          href="/profile"
          className="rounded border border-neutral-300 p-4 hover:border-neutral-500"
        >
          <h2 className="font-medium">Your profile</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Keep your contact info current so lawyers can reach you.
          </p>
        </Link>
      </div>

      <p className="mt-8 text-sm text-neutral-500">
        Phase 4 fills this dashboard with your cases, engagements, and account actions.
      </p>
      <div className="mt-6">
        <Link
          href="/become-a-lawyer"
          className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          I&apos;m a lawyer — list my practice
        </Link>
      </div>
    </main>
  );
}

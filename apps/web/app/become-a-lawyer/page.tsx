import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { becomeLawyer } from "@/lib/actions/role";

export default async function BecomeLawyerPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/become-a-lawyer");
  if (session.user.role === "lawyer") redirect("/lawyer/dashboard");

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">List your practice on Ligala</h1>
      <p className="text-neutral-600">
        You&apos;re currently signed in as a client. Switch your account to lawyer to set up
        your profile, complete KYC, and start accepting cases.
      </p>
      <form action={becomeLawyer}>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Continue as a lawyer
        </button>
      </form>
      <p className="text-sm text-neutral-500">
        Changed your mind? <Link href="/dashboard" className="underline">Back to your client dashboard</Link>.
      </p>
    </main>
  );
}

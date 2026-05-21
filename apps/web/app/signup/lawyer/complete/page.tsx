import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { claimIbpAndPromote } from "@/lib/actions/signup-lawyer";

/**
 * Post-OAuth landing for the lawyer signup flow. Better Auth has already
 * created the user + session at this point; we just need to consume the
 * IBP verification cookie and promote the user to lawyer.
 */
export default async function LawyerSignupCompletePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/signup/lawyer/complete");
  }
  if (session.user.role === "lawyer") {
    redirect("/lawyer/dashboard");
  }
  const result = await claimIbpAndPromote();
  if (result.ok) {
    redirect("/lawyer/dashboard");
  }

  const heading =
    result.code === "no_cookie"
      ? "Verification expired"
      : result.code === "already_claimed"
        ? "Already claimed"
        : "Something went wrong";

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="text-muted-foreground">{result.message}</p>
      <div className="flex justify-center gap-3">
        <Link
          href="/signup/lawyer"
          className="text-sm font-medium underline underline-offset-4"
        >
          Start over
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium underline underline-offset-4"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}

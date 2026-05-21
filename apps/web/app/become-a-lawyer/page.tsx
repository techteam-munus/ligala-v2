import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { readVerifiedIbp } from "@/lib/ibp-verification-cookie";
import { becomeLawyer } from "@/lib/actions/role";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VerifyIbpForm } from "@/app/signup/lawyer/verify-form";

const ERROR_LABEL: Record<string, string> = {
  no_cookie: "Your IBP verification expired before we could finish. Try again.",
  already_claimed: "That IBP record was just claimed by another account.",
  unknown: "Something went wrong. Please try again.",
};

export default async function BecomeLawyerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/become-a-lawyer");
  if (session.user.role === "lawyer") redirect("/lawyer/dashboard");

  const sp = await searchParams;
  const errCode = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const errorMessage = errCode ? ERROR_LABEL[errCode] ?? ERROR_LABEL.unknown : null;

  const verified = await readVerifiedIbp();

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        List your practice on Ligala
      </h1>
      <p className="text-muted-foreground">
        You&apos;re currently signed in as a client. To switch to a lawyer
        account, we need to verify you&apos;re on the IBP Roll of Attorneys.
      </p>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {verified ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium">
              {[verified.firstName, verified.middleName, verified.lastName]
                .filter(Boolean)
                .join(" ")}
            </p>
            <p className="text-muted-foreground">
              Roll No. {verified.rollNumber}
            </p>
          </div>
          <form action={becomeLawyer}>
            <Button type="submit">Continue as a lawyer</Button>
          </form>
        </div>
      ) : (
        <VerifyIbpForm />
      )}

      <p className="text-sm text-muted-foreground">
        Changed your mind?{" "}
        <Link href="/dashboard" className="underline">
          Back to your client dashboard
        </Link>
        .
      </p>
    </main>
  );
}

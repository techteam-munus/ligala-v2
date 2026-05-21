import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { readVerifiedIbp } from "@/lib/ibp-verification-cookie";
import { VerifyIbpForm } from "./verify-form";
import { LawyerAccountForm } from "./account-form";

export default async function LawyerSignupPage() {
  const session = await getSession();
  if (session) {
    if (session.user.role === "lawyer") redirect("/lawyer/dashboard");
    redirect("/become-a-lawyer");
  }

  const verified = await readVerifiedIbp();
  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#eef6f3] p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center">
          <Image
            src="/ligala-logo.svg"
            alt=""
            aria-hidden
            width={25}
            height={16}
            priority
            className="h-7 w-auto shrink-0"
          />
          <Image
            src="/ligala-text.svg"
            alt="Ligala"
            width={68}
            height={22}
            priority
            className="h-6 w-auto"
          />
        </Link>

        {verified ? (
          <LawyerAccountForm
            lawyer={{
              firstName: verified.firstName,
              middleName: verified.middleName,
              lastName: verified.lastName,
              rollNumber: verified.rollNumber,
            }}
            googleEnabled={googleEnabled}
          />
        ) : (
          <VerifyIbpForm />
        )}

        <p className="text-center text-sm text-muted-foreground">
          Not a lawyer?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create a client account
          </Link>
        </p>
      </div>
    </div>
  );
}

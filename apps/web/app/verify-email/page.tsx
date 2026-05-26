"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RESEND_COOLDOWN_SECONDS = 30;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: sessionData } = useSession();

  // Email comes from the query (signup / login-403 redirects). When a portal
  // layout bounces an unverified-but-signed-in user here it omits it, so we
  // fall back to the session's email.
  const email = searchParams.get("email") ?? sessionData?.user.email ?? "";
  const next = searchParams.get("next") ?? "/dashboard";
  // `send=1` means "no fresh code was just sent" (login-403 / layout redirect),
  // so we request one on mount. The signup path omits it because Better Auth
  // already sent a code via sendOnSignUp.
  const sendOnMount = searchParams.get("send") === "1";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoSent = useRef(false);

  async function sendCode() {
    if (!email) return;
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (sendError) {
      setError(sendError.message ?? "Could not send a code. Try again shortly.");
      return;
    }
    setNotice(`We sent a 6-digit code to ${email}.`);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  // Auto-send once on mount when arriving without a fresh code. The ref guards
  // against React Strict Mode's double-invoke and re-renders.
  useEffect(() => {
    if (sendOnMount && email && !autoSent.current) {
      autoSent.current = true;
      void sendCode();
    }
  }, [sendOnMount, email]);

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const { error: verifyError } = await authClient.emailOtp.verifyEmail({
      email,
      otp: code,
    });
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? "That code is invalid or has expired.");
      return;
    }
    // autoSignInAfterVerification has set the session cookie; the portal is now
    // reachable. roleHome resolution happens in the destination layout.
    router.push(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verify your email</CardTitle>
        <CardDescription>
          {email
            ? `Enter the 6-digit code we sent to ${email}.`
            : "Enter the 6-digit code we emailed you."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-6">
          <div className="grid gap-3">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="text-center text-lg tracking-[0.5em]"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </div>

          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? "Verifying…" : "Verify email"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Didn&apos;t get a code?{" "}
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={cooldown > 0 || !email}
              className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Back to login
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#eef6f3] p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
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
        <Suspense
          fallback={
            <div className="text-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}

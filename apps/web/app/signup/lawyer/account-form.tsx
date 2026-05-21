"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import {
  claimIbpAndPromote,
  clearIbpVerification,
} from "@/lib/actions/signup-lawyer";
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

type VerifiedLawyer = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  rollNumber: string;
};

function fullName(l: VerifiedLawyer): string {
  return [l.firstName, l.middleName, l.lastName].filter(Boolean).join(" ");
}

export function LawyerAccountForm({
  lawyer,
  googleEnabled,
}: {
  lawyer: VerifiedLawyer;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const result = await signUp.email({
      name: fullName(lawyer),
      email,
      password,
    });
    if (result.error) {
      setSubmitting(false);
      setError(result.error.message ?? "Sign up failed");
      return;
    }
    const claim = await claimIbpAndPromote();
    setSubmitting(false);
    if (!claim.ok) {
      setError(claim.message);
      return;
    }
    router.push("/lawyer/dashboard");
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setSubmitting(true);
    const result = await signIn.social({
      provider: "google",
      callbackURL: "/signup/lawyer/complete",
    });
    if (result?.error) {
      setSubmitting(false);
      setError(result.error.message ?? "Google sign-in failed");
    }
    // On success the browser redirects to Google, so no further state work.
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create your lawyer account</CardTitle>
        <CardDescription>
          Signing up as{" "}
          <span className="font-medium text-foreground">{fullName(lawyer)}</span>{" "}
          · Roll No. {lawyer.rollNumber}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid gap-3">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-3">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="confirm-password">Confirm</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  aria-invalid={mismatch || undefined}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            {mismatch ? (
              <p className="text-sm text-destructive">Passwords do not match.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Must be at least 8 characters long.
              </p>
            )}
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || mismatch}
          >
            {submitting ? "Creating account…" : "Create lawyer account"}
          </Button>

          {googleEnabled ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting}
                onClick={onGoogle}
              >
                Continue with Google
              </Button>
            </>
          ) : null}
        </form>

        <form action={clearIbpVerification} className="mt-4 text-center">
          <button
            type="submit"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Not you? Start over
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

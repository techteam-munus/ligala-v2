"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn.email({ email, password });
    setSubmitting(false);
    if (result.error) {
      // Better Auth returns 403 when requireEmailVerification blocks an
      // unverified user. Send them to the code step (send=1 — sign-in didn't
      // issue a fresh code) rather than showing a dead-end error.
      if (result.error.status === 403) {
        router.push(
          `/verify-email?email=${encodeURIComponent(email)}&send=1&next=${encodeURIComponent(next)}`,
        );
        return;
      }
      setError(result.error.message ?? "Sign in failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <div className="grid gap-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled
          title="Coming soon"
        >
          <AppleIcon />
          Login with Apple
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled
          title="Coming soon"
        >
          <GoogleIcon />
          Login with Google
        </Button>
      </div>

      <div className="relative text-center text-sm">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border"
        />
        <span className="relative bg-card px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>

      <div className="grid gap-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        <div className="flex items-center">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
          >
            Forgot your password?
          </button>
        </div>
        <PasswordInput
          id="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Login"}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
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
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>
              Login with your Apple or Google account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-foreground">
          By clicking continue, you agree to our{" "}
          <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.18 2.99-.74.78-1.95 1.39-3.05 1.31-.12-1.11.42-2.27 1.13-3.01.79-.83 2.06-1.45 3.1-1.29zM20.5 17.21c-.55 1.27-.81 1.84-1.52 2.97-.99 1.58-2.39 3.55-4.12 3.57-1.54.02-1.93-1-4.02-1-2.09.01-2.53 1.02-4.07 1-1.74-.03-3.06-1.81-4.05-3.39-2.77-4.45-3.06-9.66-1.35-12.44 1.21-1.97 3.12-3.12 4.92-3.12 1.83 0 2.98 1 4.5 1 1.47 0 2.36-1 4.49-1 1.6 0 3.3.87 4.52 2.38-3.98 2.18-3.33 7.86.7 8.03z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

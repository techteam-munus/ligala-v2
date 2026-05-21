"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { verifyIbpForSignup } from "@/lib/actions/signup-lawyer";
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

const EMPTY = {
  rollNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
};

export function VerifyIbpForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr(null);
    if (form.rollNumber.trim().length === 0) {
      setErr("Roll number is required.");
      return;
    }
    if (form.firstName.trim().length === 0 || form.lastName.trim().length === 0) {
      setErr("First and last name are required.");
      return;
    }
    start(async () => {
      const result = await verifyIbpForSignup({
        rollNumber: form.rollNumber.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
      });
      if (!result.ok) {
        setErr(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verify your IBP membership</CardTitle>
        <CardDescription>
          Enter your Roll of Attorneys number and full name. We&apos;ll match
          against the IBP directory before you create an account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid gap-3">
            <Label htmlFor="rollNumber">Roll number</Label>
            <Input
              id="rollNumber"
              value={form.rollNumber}
              onChange={(e) => update("rollNumber", e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-3">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="middleName">Middle name</Label>
              <Input
                id="middleName"
                value={form.middleName}
                onChange={(e) => update("middleName", e.target.value)}
                autoComplete="additional-name"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
          </div>
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Verifying…" : "Continue"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

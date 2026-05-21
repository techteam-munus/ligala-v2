"use client";

import { useState, useTransition } from "react";
import { createIbpLawyer } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const EMPTY = {
  firstName: "",
  middleName: "",
  lastName: "",
  address: "",
  rollSigned: "",
  rollNumber: "",
  reason: "",
};

export function AddIbpLawyerForm() {
  const [form, setForm] = useState(EMPTY);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setErr(null);
    setOk(null);
    if (form.firstName.trim().length === 0) {
      setErr("First name is required.");
      return;
    }
    if (form.lastName.trim().length === 0) {
      setErr("Last name is required.");
      return;
    }
    if (form.address.trim().length < 3) {
      setErr("Address must be at least 3 characters.");
      return;
    }
    if (!form.rollSigned) {
      setErr("Roll signed date is required.");
      return;
    }
    if (form.rollNumber.trim().length === 0) {
      setErr("Roll number is required.");
      return;
    }
    if (form.reason.trim().length < 3) {
      setErr("Reason is required (min 3 chars).");
      return;
    }
    start(async () => {
      try {
        await createIbpLawyer({
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || undefined,
          lastName: form.lastName.trim(),
          address: form.address.trim(),
          rollSigned: new Date(form.rollSigned),
          rollNumber: form.rollNumber.trim(),
          reason: form.reason.trim(),
        });
        setOk(`Added ${form.firstName} ${form.lastName}.`);
        setForm(EMPTY);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setErr(
          msg.includes("roll_number_taken")
            ? "That roll number is already in the directory."
            : msg,
        );
      }
    });
  }

  return (
    <Card className="mt-6 gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Add IBP lawyer
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ibp-first">First name</Label>
            <Input
              id="ibp-first"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ibp-middle">Middle name (optional)</Label>
            <Input
              id="ibp-middle"
              value={form.middleName}
              onChange={(e) => update("middleName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ibp-last">Last name</Label>
            <Input
              id="ibp-last"
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="ibp-address">Address</Label>
          <Input
            id="ibp-address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ibp-roll-signed">Roll signed (date)</Label>
            <Input
              id="ibp-roll-signed"
              type="date"
              value={form.rollSigned}
              onChange={(e) => update("rollSigned", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ibp-roll-number">Roll number</Label>
            <Input
              id="ibp-roll-number"
              value={form.rollNumber}
              onChange={(e) => update("rollNumber", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="ibp-reason">Reason (for audit log, min 3 chars)</Label>
          <Input
            id="ibp-reason"
            value={form.reason}
            onChange={(e) => update("reason", e.target.value)}
            placeholder="Why is this lawyer being added?"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" size="sm" disabled={pending} onClick={submit}>
            {pending ? "Adding…" : "Add lawyer"}
          </Button>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          {ok ? <p className="text-sm text-green-700">{ok}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createIbpLawyer } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Plus className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Add IBP lawyer
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Adds a new entry to the Roll of Attorneys. All changes are audit-logged.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ibp-first" className="text-xs">
              First name
            </Label>
            <Input
              id="ibp-first"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ibp-last" className="text-xs">
              Last name
            </Label>
            <Input
              id="ibp-last"
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ibp-middle" className="text-xs">
            Middle name · optional
          </Label>
          <Input
            id="ibp-middle"
            value={form.middleName}
            onChange={(e) => update("middleName", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ibp-address" className="text-xs">
            Address
          </Label>
          <Input
            id="ibp-address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ibp-roll-signed" className="text-xs">
              Roll signed
            </Label>
            <Input
              id="ibp-roll-signed"
              type="date"
              value={form.rollSigned}
              onChange={(e) => update("rollSigned", e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ibp-roll-number" className="text-xs">
              Roll number
            </Label>
            <Input
              id="ibp-roll-number"
              value={form.rollNumber}
              onChange={(e) => update("rollNumber", e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ibp-reason" className="text-xs">
            Reason · audit log
          </Label>
          <Input
            id="ibp-reason"
            value={form.reason}
            onChange={(e) => update("reason", e.target.value)}
            placeholder="Why is this lawyer being added?"
          />
        </div>

        {err ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-md border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {ok}
          </p>
        ) : null}

        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="w-full"
        >
          {pending ? "Adding…" : "Add lawyer"}
        </Button>
      </CardContent>
    </Card>
  );
}

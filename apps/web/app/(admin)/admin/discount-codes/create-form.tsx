"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { createAdminDiscountCode } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Kind = "percent" | "fixed";

const EMPTY = {
  code: "",
  kind: "percent" as Kind,
  // For kind=percent the user types a percentage like "15" → 1500 bps.
  // For kind=fixed the user types PHP like "100.00" → 10000 cents.
  value: "",
  minSubtotalPhp: "",
  maxRedemptions: "",
  validFrom: "",
  validUntil: "",
  reason: "",
};

const CODE_RE = /^[A-Z0-9_-]{3,40}$/;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function toCents(php: string): number {
  return Math.round(Number(php) * 100);
}

function toIsoOrUndefined(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function CreateDiscountCodeForm() {
  const [form, setForm] = useState(EMPTY);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY>(
    key: K,
    value: (typeof EMPTY)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setErr(null);
    setOk(null);
    const code = form.code.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      setErr("Code must be 3–40 chars: uppercase letters, digits, _ or -.");
      return;
    }
    const valueNum = Number(form.value);
    if (!form.value || Number.isNaN(valueNum) || valueNum <= 0) {
      setErr(
        form.kind === "percent"
          ? "Percent value is required (e.g. 15 for 15%)."
          : "Fixed amount is required (e.g. 100.00 PHP).",
      );
      return;
    }
    let valueBps: number | undefined;
    let valueCents: number | undefined;
    if (form.kind === "percent") {
      valueBps = Math.round(valueNum * 100);
      if (valueBps < 1 || valueBps > 10_000) {
        setErr("Percent must be between 0.01 and 100.");
        return;
      }
    } else {
      valueCents = toCents(form.value);
      if (valueCents < 1) {
        setErr("Fixed amount must be at least 0.01 PHP.");
        return;
      }
    }
    let minSubtotalCents: number | undefined;
    if (form.minSubtotalPhp.trim()) {
      const n = Number(form.minSubtotalPhp);
      if (Number.isNaN(n) || n < 0) {
        setErr("Minimum subtotal must be a non-negative amount in PHP.");
        return;
      }
      minSubtotalCents = toCents(form.minSubtotalPhp);
    }
    let maxRedemptions: number | undefined;
    if (form.maxRedemptions.trim()) {
      const n = Number(form.maxRedemptions);
      if (!Number.isInteger(n) || n < 1) {
        setErr("Max redemptions must be a positive whole number.");
        return;
      }
      maxRedemptions = n;
    }
    const validFrom = toIsoOrUndefined(form.validFrom);
    const validUntil = toIsoOrUndefined(form.validUntil);
    if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)) {
      setErr("Valid-from must be earlier than valid-until.");
      return;
    }
    if (form.reason.trim().length < 3) {
      setErr("Reason is required (min 3 chars).");
      return;
    }
    start(async () => {
      try {
        await createAdminDiscountCode({
          code,
          kind: form.kind,
          valueBps,
          valueCents,
          minSubtotalCents,
          maxRedemptions,
          validFrom,
          validUntil,
          reason: form.reason.trim(),
        });
        setOk(`Created ${code}.`);
        setForm(EMPTY);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setErr(
          msg.includes("code_already_exists")
            ? "That code already exists. Pick another."
            : msg,
        );
      }
    });
  }

  const isPercent = form.kind === "percent";

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Mint subscription code
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Admin-owned codes apply to lawyer subscription billing only.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="dc-code" className="text-xs">
            Code
          </Label>
          <Input
            id="dc-code"
            value={form.code}
            placeholder="LAUNCH15"
            onChange={(e) => update("code", e.target.value.toUpperCase())}
            className="font-mono uppercase tracking-wider"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dc-kind" className="text-xs">
            Discount type
          </Label>
          <select
            id="dc-kind"
            value={form.kind}
            onChange={(e) => update("kind", e.target.value as Kind)}
            className={SELECT_CLASS}
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dc-value" className="text-xs">
            {isPercent ? "Percent" : "Amount"}
          </Label>
          <div className="relative">
            {!isPercent ? (
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">
                ₱
              </span>
            ) : null}
            <Input
              id="dc-value"
              type="number"
              step="0.01"
              min="0.01"
              max={isPercent ? "100" : undefined}
              value={form.value}
              placeholder={isPercent ? "15" : "100.00"}
              onChange={(e) => update("value", e.target.value)}
              className={isPercent ? "pr-8 tabular-nums" : "pl-7 tabular-nums"}
            />
            {isPercent ? (
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                %
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dc-min" className="text-xs">
              Min subtotal · PHP
            </Label>
            <Input
              id="dc-min"
              type="number"
              step="0.01"
              min="0"
              value={form.minSubtotalPhp}
              onChange={(e) => update("minSubtotalPhp", e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-max" className="text-xs">
              Max redemptions
            </Label>
            <Input
              id="dc-max"
              type="number"
              step="1"
              min="1"
              value={form.maxRedemptions}
              onChange={(e) => update("maxRedemptions", e.target.value)}
              placeholder="Unlimited"
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dc-from" className="text-xs">
              Valid from
            </Label>
            <Input
              id="dc-from"
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => update("validFrom", e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-until" className="text-xs">
              Valid until
            </Label>
            <Input
              id="dc-until"
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => update("validUntil", e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dc-reason" className="text-xs">
            Reason · audit log
          </Label>
          <Input
            id="dc-reason"
            value={form.reason}
            onChange={(e) => update("reason", e.target.value)}
            placeholder="Why is this code being created?"
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
          {pending ? "Creating…" : "Create code"}
        </Button>
      </CardContent>
    </Card>
  );
}

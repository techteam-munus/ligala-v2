"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createReferral } from "@/lib/actions/referral";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type LawyerOption = {
  slug: string;
  name: string;
  location: string | null;
};

export type CaseOption = {
  id: string;
  title: string;
  status: string;
};

const NO_CASE = "__none";

export function OutboundForm({
  lawyers,
  cases,
}: {
  lawyers: LawyerOption[];
  cases: CaseOption[];
}) {
  const [slug, setSlug] = useState("");
  const [caseId, setCaseId] = useState<string>(NO_CASE);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okAt, setOkAt] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkAt(null);
    if (!slug) {
      setError("Pick a recipient lawyer.");
      return;
    }
    start(async () => {
      try {
        await createReferral({
          toLawyerSlug: slug,
          caseId: caseId === NO_CASE ? undefined : caseId,
          noteMd: note.trim() || undefined,
        });
        setSlug("");
        setCaseId(NO_CASE);
        setNote("");
        setOkAt(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <Send className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Refer a case
        </p>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">
          Recipient must be a KYC-verified lawyer. Attach a case to hand off
          on acceptance.
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ref-slug" className="text-xs">
              Recipient lawyer
            </Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger id="ref-slug" className="w-full">
                <SelectValue
                  placeholder={
                    lawyers.length === 0
                      ? "No other verified lawyers yet"
                      : "Pick a lawyer…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {lawyers.map((l) => (
                  <SelectItem key={l.slug} value={l.slug}>
                    {l.name}
                    {l.location ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {l.location}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ref-case" className="text-xs">
              Case · optional
            </Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger id="ref-case" className="w-full">
                <SelectValue placeholder="No case attached" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CASE}>No case attached</SelectItem>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                    <span className="text-muted-foreground"> · {c.status}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ref-note" className="text-xs">
              Note · optional
            </Label>
            <Textarea
              id="ref-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why this lawyer, what's been discussed already…"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {okAt ? (
            <p className="rounded-md border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              Referral sent at {okAt}.
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={pending || !slug}
            className="w-full"
          >
            {pending ? "Sending…" : "Send referral"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

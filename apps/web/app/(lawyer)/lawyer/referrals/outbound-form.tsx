"use client";

import { useState, useTransition } from "react";
import { createReferral } from "@/lib/actions/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OutboundForm() {
  const [slug, setSlug] = useState("");
  const [caseId, setCaseId] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okAt, setOkAt] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkAt(null);
    start(async () => {
      try {
        await createReferral({
          toLawyerSlug: slug.trim(),
          caseId: caseId.trim() || undefined,
          noteMd: note.trim() || undefined,
        });
        setSlug("");
        setCaseId("");
        setNote("");
        setOkAt(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card className="mt-6 gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Refer a case</CardTitle>
        <CardDescription>
          Recipient must be a KYC-verified lawyer. Attach a case id to hand off
          the case on acceptance.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ref-slug">Recipient lawyer slug</Label>
              <Input
                id="ref-slug"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="atty-final"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-case">Case id (optional)</Label>
              <Input
                id="ref-case"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder="uuid…"
                className="font-mono"
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="ref-note">Note (optional)</Label>
            <Textarea
              id="ref-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why this lawyer, what's been discussed already…"
            />
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          {okAt ? <p className="mt-2 text-sm text-green-700">Referral sent at {okAt}.</p> : null}
          <Button type="submit" disabled={pending} className="mt-4">
            {pending ? "Sending…" : "Send referral"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

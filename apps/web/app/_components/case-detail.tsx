"use client";

import { useState, useTransition } from "react";
import {
  addCaseAttachment,
  addCaseNote,
  closeCase,
  decideOnCase,
  decideOnEngagement,
  sendEngagement,
} from "@/lib/actions/case";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type CaseRow = {
  id: string;
  type: "paid" | "probono";
  status: string;
  title: string;
  description: string;
  declineReason: string | null;
  closeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Engagement = {
  id: string;
  rateType: "hourly" | "flat" | "contingency";
  hourlyCents: number | null;
  flatCents: number | null;
  contingencyBps: number | null;
  termsMd: string;
  status: "sent" | "signed" | "declined";
  sentAt: string;
  decidedAt: string | null;
  declineReason: string | null;
};

export type Note = {
  id: string;
  authorUserId: string;
  visibility: "shared" | "lawyer" | "client";
  body: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  uploaderUserId: string;
  s3Key: string;
  filename: string;
  mime: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type Activity = {
  id: string;
  actorUserId: string | null;
  kind: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

const SELECT_CLASS =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function statusBadgeClasses(status: string): string {
  if (status === "active") return "border-green-600 text-green-700";
  if (status === "closed") return "border-neutral-400 text-muted-foreground";
  if (status === "declined" || status === "cancelled")
    return "border-destructive text-destructive";
  return "border-amber-600 text-amber-700";
}

export function CaseDetail({
  viewerRole,
  caseRow,
  engagement,
  notes: initialNotes,
  attachments: initialAttachments,
  activities: initialActivities,
}: {
  viewerRole: "client" | "lawyer";
  caseRow: CaseRow;
  engagement: Engagement | null;
  notes: Note[];
  attachments: Attachment[];
  activities: Activity[];
}) {
  return (
    <div className="space-y-10">
      <CaseHeader caseRow={caseRow} viewerRole={viewerRole} />
      {viewerRole === "lawyer" && caseRow.status === "pending" ? (
        <LawyerDecision caseId={caseRow.id} />
      ) : null}
      {viewerRole === "lawyer" &&
      caseRow.status === "accepted" &&
      caseRow.type === "paid" &&
      !engagement ? (
        <SendEngagement caseId={caseRow.id} />
      ) : null}
      {engagement ? (
        <EngagementSection
          engagement={engagement}
          caseId={caseRow.id}
          viewerRole={viewerRole}
        />
      ) : null}
      {(caseRow.status === "active" ||
        (viewerRole === "client" &&
          ["pending", "accepted"].includes(caseRow.status))) && (
        <CloseOrCancel
          caseId={caseRow.id}
          status={caseRow.status}
          viewerRole={viewerRole}
        />
      )}
      <NotesSection
        caseId={caseRow.id}
        viewerRole={viewerRole}
        initial={initialNotes}
      />
      <AttachmentsSection caseId={caseRow.id} initial={initialAttachments} />
      <ActivitySection items={initialActivities} />
    </div>
  );
}

function CaseHeader({
  caseRow,
  viewerRole,
}: {
  caseRow: CaseRow;
  viewerRole: "client" | "lawyer";
}) {
  return (
    <header className="pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{caseRow.title}</h1>
        <Badge variant="secondary" className="uppercase">
          {caseRow.type}
        </Badge>
        <Badge variant="outline" className={`uppercase ${statusBadgeClasses(caseRow.status)}`}>
          {caseRow.status}
        </Badge>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm">{caseRow.description}</p>
      {caseRow.declineReason ? (
        <p className="mt-3 text-sm text-destructive">
          Declined: {caseRow.declineReason}
        </p>
      ) : null}
      {caseRow.closeReason ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {caseRow.status === "cancelled" ? "Cancelled" : "Closed"}: {caseRow.closeReason}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">Viewing as {viewerRole}</p>
      <Separator className="mt-4" />
    </header>
  );
}

function LawyerDecision({ caseId }: { caseId: string }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(decision: "accept" | "decline") {
    setError(null);
    start(async () => {
      try {
        await decideOnCase(caseId, { decision, reason: reason || undefined });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card className="gap-2 border-amber-300 bg-amber-50/50 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Decide</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm">
          Accept to start a paid engagement (you&apos;ll send terms next) or to begin pro bono work.
        </p>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (shown to client on decline)"
          className="mt-3"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => go("accept")}
            className="bg-green-700 hover:bg-green-800"
          >
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => go("decline")}
            className="border-destructive text-destructive hover:text-destructive"
          >
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SendEngagement({ caseId }: { caseId: string }) {
  const [form, setForm] = useState({
    rateType: "hourly" as "hourly" | "flat" | "contingency",
    hourlyCents: "",
    flatCents: "",
    contingencyBps: "",
    termsMd: "",
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await sendEngagement(caseId, {
          rateType: form.rateType,
          hourlyCents:
            form.rateType === "hourly" && form.hourlyCents
              ? Number.parseInt(form.hourlyCents, 10)
              : null,
          flatCents:
            form.rateType === "flat" && form.flatCents
              ? Number.parseInt(form.flatCents, 10)
              : null,
          contingencyBps:
            form.rateType === "contingency" && form.contingencyBps
              ? Number.parseInt(form.contingencyBps, 10)
              : null,
          termsMd: form.termsMd,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card className="gap-2 border-blue-300 bg-blue-50/50 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Send engagement terms</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rateType">Rate type</Label>
            <select
              id="rateType"
              value={form.rateType}
              onChange={(e) =>
                setForm({ ...form, rateType: e.target.value as typeof form.rateType })
              }
              className={`w-full ${SELECT_CLASS}`}
            >
              <option value="hourly">Hourly</option>
              <option value="flat">Flat fee</option>
              <option value="contingency">Contingency</option>
            </select>
          </div>
          {form.rateType === "hourly" ? (
            <div className="space-y-1.5">
              <Label htmlFor="hourlyCents">Hourly rate (cents)</Label>
              <Input
                id="hourlyCents"
                type="number"
                min={0}
                value={form.hourlyCents}
                onChange={(e) => setForm({ ...form, hourlyCents: e.target.value })}
                placeholder="e.g. 250000 = ₱2,500/hr"
              />
            </div>
          ) : null}
          {form.rateType === "flat" ? (
            <div className="space-y-1.5">
              <Label htmlFor="flatCents">Flat fee (cents)</Label>
              <Input
                id="flatCents"
                type="number"
                min={0}
                value={form.flatCents}
                onChange={(e) => setForm({ ...form, flatCents: e.target.value })}
              />
            </div>
          ) : null}
          {form.rateType === "contingency" ? (
            <div className="space-y-1.5">
              <Label htmlFor="contingencyBps">Contingency (basis points; 1% = 100)</Label>
              <Input
                id="contingencyBps"
                type="number"
                min={0}
                max={10000}
                value={form.contingencyBps}
                onChange={(e) => setForm({ ...form, contingencyBps: e.target.value })}
                placeholder="e.g. 3000 = 30%"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="termsMd">Terms</Label>
            <Textarea
              id="termsMd"
              required
              minLength={10}
              rows={6}
              value={form.termsMd}
              onChange={(e) => setForm({ ...form, termsMd: e.target.value })}
              className="font-mono"
              placeholder="Scope, payment schedule, termination clauses…"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Send to client"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EngagementSection({
  engagement,
  caseId,
  viewerRole,
}: {
  engagement: Engagement;
  caseId: string;
  viewerRole: "client" | "lawyer";
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(decision: "sign" | "decline") {
    setError(null);
    start(async () => {
      try {
        await decideOnEngagement(engagement.id, caseId, {
          decision,
          reason: reason || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const rateLabel =
    engagement.rateType === "hourly"
      ? `${engagement.hourlyCents}¢/hr`
      : engagement.rateType === "flat"
        ? `${engagement.flatCents}¢ flat`
        : `${((engagement.contingencyBps ?? 0) / 100).toFixed(2)}% contingency`;

  const engagementStatusClass =
    engagement.status === "signed"
      ? "border-green-600 text-green-700"
      : engagement.status === "declined"
        ? "border-destructive text-destructive"
        : "border-amber-600 text-amber-700";

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Engagement terms</CardTitle>
          <Badge variant="outline" className={`uppercase ${engagementStatusClass}`}>
            {engagement.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm">
          <span className="text-muted-foreground">Rate:</span> {rateLabel}
        </p>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs">
          {engagement.termsMd}
        </pre>
        {viewerRole === "client" && engagement.status === "sent" ? (
          <div className="mt-3 space-y-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason (shown to lawyer on decline)"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => go("sign")}
                className="bg-green-700 hover:bg-green-800"
              >
                Sign and start
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => go("decline")}
                className="border-destructive text-destructive hover:text-destructive"
              >
                Decline terms
              </Button>
            </div>
          </div>
        ) : null}
        {engagement.declineReason ? (
          <p className="mt-2 text-sm text-destructive">
            Declined: {engagement.declineReason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CloseOrCancel({
  caseId,
  status,
  viewerRole,
}: {
  caseId: string;
  status: string;
  viewerRole: "client" | "lawyer";
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canCancel =
    viewerRole === "client" && ["pending", "accepted"].includes(status);
  const canClose = status === "active";

  function go(action: "close" | "cancel") {
    setError(null);
    start(async () => {
      try {
        await closeCase(caseId, { action, reason: reason || undefined });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  if (!canCancel && !canClose) return null;

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{canClose ? "Close case" : "Cancel case"}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => go(canClose ? "close" : "cancel")}
          >
            {canClose ? "Close case" : "Cancel case"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotesSection({
  caseId,
  viewerRole,
  initial,
}: {
  caseId: string;
  viewerRole: "client" | "lawyer";
  initial: Note[];
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"shared" | "lawyer" | "client">("shared");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await addCaseNote(caseId, { body, visibility });
        setBody("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Notes</h2>
      {initial.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {initial.map((n) => (
            <li key={n.id}>
              <Card className="gap-1 py-3">
                <CardContent className="px-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {n.visibility} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">{n.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-4 space-y-2">
        <Textarea
          required
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
        />
        <div className="flex items-center gap-3">
          <select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as "shared" | "lawyer" | "client")
            }
            className={SELECT_CLASS}
          >
            <option value="shared">Shared</option>
            {viewerRole === "lawyer" ? <option value="lawyer">Lawyer only</option> : null}
            {viewerRole === "client" ? <option value="client">Private (you)</option> : null}
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Adding…" : "Add note"}
          </Button>
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}

function AttachmentsSection({
  caseId,
  initial,
}: {
  caseId: string;
  initial: Attachment[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const presignRes = await fetch("/api/files/presign-proxy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mime: file.type || "application/octet-stream",
            sizeBytes: file.size,
            kind: "case_attachment",
          }),
        });
        if (!presignRes.ok) throw new Error("presign failed");
        const presign = (await presignRes.json()) as { uploadUrl: string; s3Key: string };
        const put = await fetch(presign.uploadUrl, { method: "PUT", body: file });
        if (!put.ok) throw new Error("upload failed");
        await addCaseAttachment(caseId, {
          s3Key: presign.s3Key,
          filename: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
    e.target.value = "";
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Attachments</h2>
      {initial.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No files attached yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {initial.map((a) => (
            <li key={a.id}>
              <Card className="gap-0 py-2">
                <CardContent className="px-3">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{a.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.mime} · {a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} KB` : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
          <input type="file" className="hidden" onChange={onFile} disabled={pending} />
          {pending ? "Uploading…" : "Attach file"}
        </label>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}

function ActivitySection({ items }: { items: Activity[] }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">Activity</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {items.map((a) => (
          <li key={a.id}>
            <Card className="gap-1 py-3">
              <CardContent className="px-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
                <p className="mt-1">
                  <strong>{a.kind}</strong>
                  {a.payload && Object.keys(a.payload).length > 0 ? (
                    <span className="ml-2 text-muted-foreground">
                      {JSON.stringify(a.payload)}
                    </span>
                  ) : null}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

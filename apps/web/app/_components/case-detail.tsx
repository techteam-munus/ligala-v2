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
      <AttachmentsSection
        caseId={caseRow.id}
        initial={initialAttachments}
      />
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
    <header className="border-b border-neutral-200 pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{caseRow.title}</h1>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-700">
          {caseRow.type}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
            caseRow.status === "active"
              ? "bg-green-100 text-green-800"
              : caseRow.status === "closed"
                ? "bg-neutral-200 text-neutral-700"
                : caseRow.status === "declined" || caseRow.status === "cancelled"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {caseRow.status}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-neutral-700">
        {caseRow.description}
      </p>
      {caseRow.declineReason ? (
        <p className="mt-3 text-sm text-red-700">
          Declined: {caseRow.declineReason}
        </p>
      ) : null}
      {caseRow.closeReason ? (
        <p className="mt-3 text-sm text-neutral-500">
          {caseRow.status === "cancelled" ? "Cancelled" : "Closed"}: {caseRow.closeReason}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-neutral-500">
        Viewing as {viewerRole}
      </p>
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
    <section className="rounded border border-yellow-300 bg-yellow-50 p-4">
      <h2 className="font-medium">Decide</h2>
      <p className="mt-1 text-sm text-neutral-700">
        Accept to start a paid engagement (you&apos;ll send terms next) or to begin pro bono work.
      </p>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional reason (shown to client on decline)"
        className="mt-3 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
      />
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => go("accept")}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => go("decline")}
          className="rounded border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </section>
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
    <section className="rounded border border-blue-300 bg-blue-50 p-4">
      <h2 className="font-medium">Send engagement terms</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="rateType" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
            Rate type
          </label>
          <select
            id="rateType"
            value={form.rateType}
            onChange={(e) =>
              setForm({ ...form, rateType: e.target.value as typeof form.rateType })
            }
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="hourly">Hourly</option>
            <option value="flat">Flat fee</option>
            <option value="contingency">Contingency</option>
          </select>
        </div>
        {form.rateType === "hourly" ? (
          <div>
            <label htmlFor="hourlyCents" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
              Hourly rate (cents)
            </label>
            <input
              id="hourlyCents"
              type="number"
              min={0}
              value={form.hourlyCents}
              onChange={(e) => setForm({ ...form, hourlyCents: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="e.g. 250000 = ₱2,500/hr"
            />
          </div>
        ) : null}
        {form.rateType === "flat" ? (
          <div>
            <label htmlFor="flatCents" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
              Flat fee (cents)
            </label>
            <input
              id="flatCents"
              type="number"
              min={0}
              value={form.flatCents}
              onChange={(e) => setForm({ ...form, flatCents: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        ) : null}
        {form.rateType === "contingency" ? (
          <div>
            <label htmlFor="contingencyBps" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
              Contingency (basis points; 1% = 100)
            </label>
            <input
              id="contingencyBps"
              type="number"
              min={0}
              max={10000}
              value={form.contingencyBps}
              onChange={(e) => setForm({ ...form, contingencyBps: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="e.g. 3000 = 30%"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="termsMd" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
            Terms
          </label>
          <textarea
            id="termsMd"
            required
            minLength={10}
            rows={6}
            value={form.termsMd}
            onChange={(e) => setForm({ ...form, termsMd: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-mono"
            placeholder="Scope, payment schedule, termination clauses…"
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to client"}
        </button>
      </form>
    </section>
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

  return (
    <section className="rounded border border-neutral-300 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Engagement terms</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
            engagement.status === "signed"
              ? "bg-green-100 text-green-800"
              : engagement.status === "declined"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {engagement.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-700">
        <span className="text-neutral-500">Rate:</span> {rateLabel}
      </p>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
        {engagement.termsMd}
      </pre>
      {viewerRole === "client" && engagement.status === "sent" ? (
        <div className="mt-3">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason (shown to lawyer on decline)"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => go("sign")}
              className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Sign and start
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => go("decline")}
              className="rounded border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              Decline terms
            </button>
          </div>
        </div>
      ) : null}
      {engagement.declineReason ? (
        <p className="mt-2 text-sm text-red-700">
          Declined: {engagement.declineReason}
        </p>
      ) : null}
    </section>
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
    <section className="rounded border border-neutral-300 p-4">
      <h2 className="font-medium">{canClose ? "Close case" : "Cancel case"}</h2>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional reason"
        className="mt-3 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
      />
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => go(canClose ? "close" : "cancel")}
          className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {canClose ? "Close case" : "Cancel case"}
        </button>
      </div>
    </section>
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
        <p className="mt-2 text-sm text-neutral-500">No notes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {initial.map((n) => (
            <li key={n.id} className="rounded border border-neutral-200 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                {n.visibility} · {new Date(n.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-4 space-y-2">
        <textarea
          required
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Add a note…"
        />
        <div className="flex items-center gap-3">
          <select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as "shared" | "lawyer" | "client")
            }
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="shared">Shared</option>
            {viewerRole === "lawyer" ? <option value="lawyer">Lawyer only</option> : null}
            {viewerRole === "client" ? <option value="client">Private (you)</option> : null}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add note"}
          </button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
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
        // Presign via the same dev proxy used by KYC uploads.
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
        <p className="mt-2 text-sm text-neutral-500">No files attached yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {initial.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded border border-neutral-200 p-2">
              <span className="truncate">{a.filename}</span>
              <span className="text-xs text-neutral-500">
                {a.mime} · {a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} KB` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-neutral-300 px-3 py-1.5 text-sm">
          <input type="file" className="hidden" onChange={onFile} disabled={pending} />
          {pending ? "Uploading…" : "Attach file"}
        </label>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
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
          <li key={a.id} className="rounded border border-neutral-200 p-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {new Date(a.createdAt).toLocaleString()}
            </p>
            <p className="mt-1">
              <strong>{a.kind}</strong>
              {a.payload && Object.keys(a.payload).length > 0 ? (
                <span className="ml-2 text-neutral-500">
                  {JSON.stringify(a.payload)}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

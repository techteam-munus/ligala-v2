"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Hash,
  MessageCircle,
  Paperclip,
  ScrollText,
  Share2,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  addCaseAttachment,
  addCaseNote,
  closeCase,
  decideOnCase,
  decideOnEngagement,
  getCaseAttachmentViewUrl,
  sendEngagement,
} from "@/lib/actions/case";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  CaseStatusPill,
  CaseTypePill,
  type CaseStatus,
} from "@/app/_components/case-status";

export type CaseRow = {
  id: string;
  type: "paid" | "probono";
  status: CaseStatus;
  title: string;
  description: string;
  declineReason: string | null;
  closeReason: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
  closedAt?: string | null;
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
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// ---- formatters --------------------------------------------------------

function longDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function pesoFromCents(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// ---- top-level component ----------------------------------------------

export function CaseDetail({
  viewerRole,
  caseRow,
  engagement,
  notes: initialNotes,
  attachments: initialAttachments,
  activities: initialActivities,
  /** Optional slot for role-specific extras (e.g. lawyer billing card). */
  extras,
}: {
  viewerRole: "client" | "lawyer";
  caseRow: CaseRow;
  engagement: Engagement | null;
  notes: Note[];
  attachments: Attachment[];
  activities: Activity[];
  extras?: ReactNode;
}) {
  const backHref = viewerRole === "lawyer" ? "/lawyer/cases" : "/cases";

  // Top-of-page urgent action banners.
  const showLawyerDecisionBanner =
    viewerRole === "lawyer" && caseRow.status === "pending";
  const showClientSignBanner =
    viewerRole === "client" &&
    engagement?.status === "sent" &&
    caseRow.status === "accepted";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Breadcrumb back */}
      <Link
        href={backHref as never}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All cases
      </Link>

      {/* Hero header */}
      <header className="mt-3 border-b border-border/60 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {viewerRole === "lawyer" ? "Lawyer · Case" : "Client · Case"}
        </p>
        <div className="mt-1 flex flex-wrap items-start gap-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {caseRow.title}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <CaseStatusPill status={caseRow.status} />
            <CaseTypePill kind={caseRow.type} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <MetaInline
            icon={<CircleDashed className="size-3.5" />}
            label="Created"
            value={longDate(caseRow.createdAt) ?? "—"}
          />
          {caseRow.decidedAt ? (
            <MetaInline
              icon={<CheckCircle2 className="size-3.5" />}
              label={
                caseRow.status === "declined" ? "Declined" : "Decided"
              }
              value={longDate(caseRow.decidedAt) ?? "—"}
              tone={caseRow.status === "declined" ? "danger" : "success"}
            />
          ) : null}
          {caseRow.closedAt ? (
            <MetaInline
              icon={<XCircle className="size-3.5" />}
              label={caseRow.status === "cancelled" ? "Cancelled" : "Closed"}
              value={longDate(caseRow.closedAt) ?? "—"}
              tone="muted"
            />
          ) : null}
        </div>
      </header>

      {/* Urgent action banners ---------------------------------------- */}
      {showLawyerDecisionBanner ? (
        <DecisionBanner caseId={caseRow.id} />
      ) : null}
      {showClientSignBanner && engagement ? (
        <SignBanner engagement={engagement} caseId={caseRow.id} />
      ) : null}

      {/* Two-column body ----------------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left column =================================================== */}
        <div className="space-y-6">
          {/* Description ------------------------------------------------ */}
          <Card size="sm" className="gap-3">
            <CardHeader>
              <SectionLabel>Description</SectionLabel>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {caseRow.description}
              </p>
              {caseRow.declineReason ? (
                <div className="mt-4 rounded-md border border-rose-200/60 bg-rose-50/40 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  <p className="text-[10px] font-semibold uppercase tracking-wider">
                    Declined
                  </p>
                  <p className="mt-0.5">{caseRow.declineReason}</p>
                </div>
              ) : null}
              {caseRow.closeReason ? (
                <div className="mt-4 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {caseRow.status === "cancelled" ? "Cancelled" : "Closed"}
                  </p>
                  <p className="mt-0.5">{caseRow.closeReason}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Engagement (if exists) ----------------------------------- */}
          {engagement ? (
            <EngagementCard
              engagement={engagement}
              caseId={caseRow.id}
              viewerRole={viewerRole}
            />
          ) : null}

          {/* Notes ---------------------------------------------------- */}
          <NotesSection
            caseId={caseRow.id}
            viewerRole={viewerRole}
            initial={initialNotes}
          />

          {/* Attachments ---------------------------------------------- */}
          <AttachmentsSection
            caseId={caseRow.id}
            initial={initialAttachments}
          />

          {/* Activity timeline --------------------------------------- */}
          {initialActivities.length > 0 ? (
            <Card size="sm" className="gap-3">
              <CardHeader className="flex-row items-center justify-between">
                <SectionLabel>Activity</SectionLabel>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {initialActivities.length} event
                  {initialActivities.length === 1 ? "" : "s"}
                </span>
              </CardHeader>
              <CardContent>
                <ActivityTimeline items={initialActivities} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right column ================================================= */}
        <aside className="space-y-4 lg:self-start">
          {/* Actions panel (when there's something to do) ------------- */}
          <ActionsPanel
            viewerRole={viewerRole}
            caseRow={caseRow}
            engagement={engagement}
          />

          {/* Slot for role-specific extras (e.g. billing card) -------- */}
          {extras}

          {/* Meta card ------------------------------------------------- */}
          <Card size="sm" className="gap-2">
            <CardHeader>
              <SectionLabel>Details</SectionLabel>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-xs">
                <MetaRow
                  icon={<Hash className="size-3.5" />}
                  label="Case ID"
                  value={
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {caseRow.id.slice(0, 8)}…
                    </span>
                  }
                />
                <MetaRow
                  icon={<Sparkles className="size-3.5" />}
                  label="Type"
                  value={
                    caseRow.type === "probono" ? "Pro bono" : "Paid"
                  }
                />
                <MetaRow
                  icon={<CircleDashed className="size-3.5" />}
                  label="Created"
                  value={longDate(caseRow.createdAt) ?? "—"}
                />
                {caseRow.decidedAt ? (
                  <MetaRow
                    icon={<CheckCircle2 className="size-3.5" />}
                    label={
                      caseRow.status === "declined" ? "Declined" : "Decided"
                    }
                    value={longDate(caseRow.decidedAt) ?? "—"}
                  />
                ) : null}
                {engagement ? (
                  <MetaRow
                    icon={<ScrollText className="size-3.5" />}
                    label="Engagement"
                    value={`${engagement.status} · ${shortDate(engagement.sentAt)}`}
                  />
                ) : null}
                {caseRow.closedAt ? (
                  <MetaRow
                    icon={<XCircle className="size-3.5" />}
                    label={
                      caseRow.status === "cancelled" ? "Cancelled" : "Closed"
                    }
                    value={longDate(caseRow.closedAt) ?? "—"}
                  />
                ) : null}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------- tiny building blocks ---------------------------------------

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

function MetaInline({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "success" && "text-emerald-700 dark:text-emerald-300",
        tone === "danger" && "text-rose-700 dark:text-rose-300",
        tone === "muted" && "text-muted-foreground/70",
      )}
    >
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </span>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

// ---------- urgent banners ---------------------------------------------

function DecisionBanner({ caseId }: { caseId: string }) {
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
    <div className="mt-6 overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Awaiting your decision
          </p>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">
            Accept to start an engagement (paid) or begin work (pro bono),
            or decline with a reason.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/60 bg-card/30 px-4 py-3 dark:border-amber-900/40">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (shown to client on decline)"
          className="flex-1 min-w-[14rem] bg-background"
        />
        <Button
          type="button"
          disabled={pending}
          onClick={() => go("accept")}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? "…" : "Accept"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => go("decline")}
          className="border-rose-500/60 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          Decline
        </Button>
      </div>
      {error ? (
        <p className="border-t border-amber-200/60 bg-card/30 px-4 py-2 text-xs text-destructive dark:border-amber-900/40">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SignBanner({
  engagement,
  caseId,
}: {
  engagement: Engagement;
  caseId: string;
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

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-sky-200/70 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
            Awaiting your signature
          </p>
          <p className="mt-1 text-sm text-sky-900/90 dark:text-sky-100/90">
            Review the engagement terms below. Signing starts the matter.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-sky-200/60 bg-card/30 px-4 py-3 dark:border-sky-900/40">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (shown to lawyer on decline)"
          className="flex-1 min-w-[14rem] bg-background"
        />
        <Button
          type="button"
          disabled={pending}
          onClick={() => go("sign")}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? "…" : "Sign & start"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => go("decline")}
          className="border-rose-500/60 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          Decline terms
        </Button>
      </div>
      {error ? (
        <p className="border-t border-sky-200/60 bg-card/30 px-4 py-2 text-xs text-destructive dark:border-sky-900/40">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Engagement card --------------------------------------------

function EngagementCard({
  engagement,
  caseId,
  viewerRole,
}: {
  engagement: Engagement;
  caseId: string;
  viewerRole: "client" | "lawyer";
}) {
  const rateLabel =
    engagement.rateType === "hourly"
      ? `${pesoFromCents(engagement.hourlyCents)} / hour`
      : engagement.rateType === "flat"
        ? `${pesoFromCents(engagement.flatCents)} flat`
        : `${((engagement.contingencyBps ?? 0) / 100).toFixed(2)}% contingency`;

  const engagementBadgeTone =
    engagement.status === "signed"
      ? "ring-emerald-200/70 text-emerald-700 bg-emerald-50/40 dark:text-emerald-300 dark:bg-emerald-950/20 dark:ring-emerald-900/40"
      : engagement.status === "declined"
        ? "ring-rose-200/70 text-rose-700 bg-rose-50/40 dark:text-rose-300 dark:bg-rose-950/20 dark:ring-rose-900/40"
        : "ring-amber-200/70 text-amber-700 bg-amber-50/40 dark:text-amber-300 dark:bg-amber-950/20 dark:ring-amber-900/40";

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="size-3.5 text-muted-foreground" />
          <SectionLabel>Engagement terms</SectionLabel>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset",
            engagementBadgeTone,
          )}
        >
          {engagement.status}
        </span>
      </div>
      <CardContent className="px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Rate
            </p>
            <p className="mt-1 text-base font-medium tabular-nums">
              {rateLabel}
            </p>
            <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
              {engagement.rateType}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sent
            </p>
            <p className="mt-1 text-sm tabular-nums">
              {longDate(engagement.sentAt)}
            </p>
            {engagement.decidedAt ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Decided {longDate(engagement.decidedAt)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Terms
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {engagement.termsMd}
          </pre>
        </div>
        {engagement.declineReason ? (
          <div className="mt-3 rounded-md border border-rose-200/60 bg-rose-50/40 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            <p className="text-[10px] font-semibold uppercase tracking-wider">
              Decline reason
            </p>
            <p className="mt-0.5">{engagement.declineReason}</p>
          </div>
        ) : null}
        {/* Inline sign/decline UI is also surfaced via the top banner for
            clients; we keep this inline mirror so a scrolled user has the
            controls right next to the terms. */}
        {viewerRole === "client" && engagement.status === "sent" ? (
          <InlineEngagementDecision
            engagementId={engagement.id}
            caseId={caseId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function InlineEngagementDecision({
  engagementId,
  caseId,
}: {
  engagementId: string;
  caseId: string;
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(decision: "sign" | "decline") {
    setError(null);
    start(async () => {
      try {
        await decideOnEngagement(engagementId, caseId, {
          decision,
          reason: reason || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="mt-4 space-y-2 rounded-md border border-border/60 bg-card p-3">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional decline reason"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => go("sign")}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? "…" : "Sign & start"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => go("decline")}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

// ---------- Actions sidebar panel --------------------------------------

function ActionsPanel({
  viewerRole,
  caseRow,
  engagement,
}: {
  viewerRole: "client" | "lawyer";
  caseRow: CaseRow;
  engagement: Engagement | null;
}) {
  const canSendEngagement =
    viewerRole === "lawyer" &&
    caseRow.status === "accepted" &&
    caseRow.type === "paid" &&
    !engagement;

  const canClose =
    caseRow.status === "active" ||
    (viewerRole === "client" &&
      (caseRow.status === "pending" || caseRow.status === "accepted"));

  if (!canSendEngagement && !canClose) return null;

  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <SectionLabel>Actions</SectionLabel>
      </CardHeader>
      <CardContent className="space-y-3">
        {canSendEngagement ? <SendEngagementForm caseId={caseRow.id} /> : null}
        {canClose ? (
          <CloseOrCancelForm
            caseId={caseRow.id}
            status={caseRow.status}
            viewerRole={viewerRole}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SendEngagementForm({ caseId }: { caseId: string }) {
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
    <div className="space-y-3 rounded-md border border-sky-200/60 bg-sky-50/40 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
        Send engagement
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="rateType" className="text-xs">
            Rate type
          </Label>
          <select
            id="rateType"
            value={form.rateType}
            onChange={(e) =>
              setForm({
                ...form,
                rateType: e.target.value as typeof form.rateType,
              })
            }
            className={SELECT_CLASS}
          >
            <option value="hourly">Hourly</option>
            <option value="flat">Flat fee</option>
            <option value="contingency">Contingency</option>
          </select>
        </div>
        {form.rateType === "hourly" ? (
          <div className="space-y-1.5">
            <Label htmlFor="hourlyCents" className="text-xs">
              Hourly rate · cents
            </Label>
            <Input
              id="hourlyCents"
              type="number"
              min={0}
              value={form.hourlyCents}
              onChange={(e) =>
                setForm({ ...form, hourlyCents: e.target.value })
              }
              placeholder="250000 = ₱2,500/hr"
              className="bg-background"
            />
          </div>
        ) : null}
        {form.rateType === "flat" ? (
          <div className="space-y-1.5">
            <Label htmlFor="flatCents" className="text-xs">
              Flat fee · cents
            </Label>
            <Input
              id="flatCents"
              type="number"
              min={0}
              value={form.flatCents}
              onChange={(e) => setForm({ ...form, flatCents: e.target.value })}
              className="bg-background"
            />
          </div>
        ) : null}
        {form.rateType === "contingency" ? (
          <div className="space-y-1.5">
            <Label htmlFor="contingencyBps" className="text-xs">
              Contingency · basis points
            </Label>
            <Input
              id="contingencyBps"
              type="number"
              min={0}
              max={10000}
              value={form.contingencyBps}
              onChange={(e) =>
                setForm({ ...form, contingencyBps: e.target.value })
              }
              placeholder="3000 = 30%"
              className="bg-background"
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="termsMd" className="text-xs">
            Terms
          </Label>
          <Textarea
            id="termsMd"
            required
            minLength={10}
            rows={5}
            value={form.termsMd}
            onChange={(e) => setForm({ ...form, termsMd: e.target.value })}
            className="bg-background font-mono text-xs"
            placeholder="Scope, payment schedule, termination clauses…"
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" size="sm" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Send to client"}
        </Button>
      </form>
    </div>
  );
}

function CloseOrCancelForm({
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
    viewerRole === "client" && (status === "pending" || status === "accepted");
  const action: "close" | "cancel" = canCancel ? "cancel" : "close";

  function go() {
    setError(null);
    start(async () => {
      try {
        await closeCase(caseId, { action, reason: reason || undefined });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {canCancel ? "Cancel case" : "Close case"}
      </p>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional reason"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={go}
        className="w-full"
      >
        {pending
          ? "…"
          : canCancel
            ? "Cancel this case"
            : "Mark closed"}
      </Button>
    </div>
  );
}

// ---------- Notes thread -----------------------------------------------

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
  const [visibility, setVisibility] =
    useState<"shared" | "lawyer" | "client">("shared");
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
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-3.5 text-muted-foreground" />
          <SectionLabel>Notes</SectionLabel>
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {initial.length}
          </span>
        </div>
      </div>
      <CardContent className="px-0">
        {initial.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notes yet — start the conversation below.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {initial.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <NoteVisibilityChip visibility={n.visibility} />
                  <span className="text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Composer */}
        <form
          onSubmit={submit}
          className="space-y-2 border-t border-border/60 bg-muted/20 px-4 py-3"
        >
          <Textarea
            required
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note…"
            className="bg-background"
          />
          <div className="flex items-center gap-2">
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(
                  e.target.value as "shared" | "lawyer" | "client",
                )
              }
              className={cn(SELECT_CLASS, "w-auto pr-8")}
            >
              <option value="shared">Shared</option>
              {viewerRole === "lawyer" ? (
                <option value="lawyer">Lawyer only</option>
              ) : null}
              {viewerRole === "client" ? (
                <option value="client">Private (you)</option>
              ) : null}
            </select>
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {pending ? "Adding…" : "Add note"}
            </Button>
            {error ? (
              <span className="text-xs text-destructive">{error}</span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function NoteVisibilityChip({ visibility }: { visibility: Note["visibility"] }) {
  const map = {
    shared: {
      label: "Shared",
      tone:
        "bg-sky-500/10 text-sky-700 ring-sky-200/60 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-900/40",
    },
    lawyer: {
      label: "Lawyer only",
      tone:
        "bg-violet-500/10 text-violet-700 ring-violet-200/60 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-900/40",
    },
    client: {
      label: "Private",
      tone:
        "bg-muted text-muted-foreground ring-border/60",
    },
  } as const;
  const m = map[visibility];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        m.tone,
      )}
    >
      {m.label}
    </span>
  );
}

// ---------- Attachments ------------------------------------------------

function ViewAttachmentButton({
  caseId,
  attachmentId,
}: {
  caseId: string;
  attachmentId: string;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    // Open a tab synchronously inside the click handler so popup blockers
    // accept it; navigate it to the signed URL once the action returns.
    // Browsers also auto-block window.open if it happens after an awaited
    // network call.
    const tab = window.open("about:blank", "_blank", "noopener");
    start(async () => {
      try {
        const url = await getCaseAttachmentViewUrl(caseId, attachmentId);
        if (tab) tab.location.href = url;
        else window.open(url, "_blank", "noopener");
      } catch {
        if (tab) tab.close();
      }
    });
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label="Open attachment in new tab"
    >
      <ExternalLink className="size-3.5" />
      {pending ? "Opening…" : "View"}
    </Button>
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
            kind: "case_attachment",
            contentType: file.type || "application/octet-stream",
            byteSize: file.size,
          }),
        });
        if (!presignRes.ok) throw new Error("presign failed");
        const presign = (await presignRes.json()) as {
          uploadUrl: string;
          s3Key: string;
        };
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: file,
        });
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
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <SectionLabel>Attachments</SectionLabel>
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {initial.length}
          </span>
        </div>
        <Button asChild variant="outline" size="sm" disabled={pending}>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={onFile}
              disabled={pending}
            />
            <Paperclip />
            {pending ? "Uploading…" : "Attach"}
          </label>
        </Button>
      </div>
      <CardContent className="px-0">
        {initial.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No files attached yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {initial.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.filename}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.mime}
                      {a.sizeBytes
                        ? ` · ${(a.sizeBytes / 1024).toFixed(0)} KB`
                        : ""}{" "}
                      · {relativeTime(a.createdAt)}
                    </p>
                  </div>
                </div>
                <ViewAttachmentButton caseId={caseId} attachmentId={a.id} />
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="border-t border-border/60 px-4 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------- Activity timeline ------------------------------------------

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Case created",
  accepted: "Lawyer accepted",
  declined: "Lawyer declined",
  engagement_sent: "Engagement sent",
  engagement_signed: "Engagement signed",
  engagement_declined: "Engagement declined",
  activated: "Case activated",
  note_added: "Note added",
  attachment_added: "File attached",
  closed: "Case closed",
  cancelled: "Case cancelled",
  referred: "Referred",
  referral_accepted: "Referral accepted",
  referral_declined: "Referral declined",
};

const ACTIVITY_TONE: Record<
  string,
  { dot: string; icon: ReactNode }
> = {
  created: { dot: "bg-emerald-500", icon: <Sparkles className="size-3" /> },
  accepted: { dot: "bg-emerald-500", icon: <CheckCircle2 className="size-3" /> },
  declined: { dot: "bg-rose-500", icon: <XCircle className="size-3" /> },
  engagement_sent: { dot: "bg-sky-500", icon: <ScrollText className="size-3" /> },
  engagement_signed: {
    dot: "bg-emerald-500",
    icon: <CheckCircle2 className="size-3" />,
  },
  engagement_declined: {
    dot: "bg-rose-500",
    icon: <XCircle className="size-3" />,
  },
  activated: { dot: "bg-emerald-500", icon: <Sparkles className="size-3" /> },
  note_added: { dot: "bg-zinc-400", icon: <MessageCircle className="size-3" /> },
  attachment_added: {
    dot: "bg-zinc-400",
    icon: <Paperclip className="size-3" />,
  },
  closed: { dot: "bg-zinc-400", icon: <XCircle className="size-3" /> },
  cancelled: { dot: "bg-zinc-400", icon: <XCircle className="size-3" /> },
  referred: { dot: "bg-sky-500", icon: <Share2 className="size-3" /> },
  referral_accepted: {
    dot: "bg-emerald-500",
    icon: <CheckCircle2 className="size-3" />,
  },
  referral_declined: {
    dot: "bg-rose-500",
    icon: <XCircle className="size-3" />,
  },
};

function ActivityTimeline({ items }: { items: Activity[] }) {
  // Show oldest → newest in a vertical timeline.
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border/60 pl-5">
      {items.map((a) => {
        const label = ACTIVITY_LABEL[a.kind] ?? a.kind;
        const tone = ACTIVITY_TONE[a.kind] ?? {
          dot: "bg-zinc-400",
          icon: null,
        };
        return (
          <li key={a.id} className="relative">
            <span
              className={cn(
                "absolute -left-[27px] top-1.5 size-2 rounded-full ring-4 ring-background",
                tone.dot,
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {tone.icon ? (
                  <span className="text-muted-foreground">{tone.icon}</span>
                ) : null}
                <p className="text-sm font-medium">{label}</p>
              </div>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {shortDate(a.createdAt)}
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                {new Intl.DateTimeFormat("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(a.createdAt))}
              </p>
            </div>
            {a.payload && Object.keys(a.payload).length > 0 ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                {summarisePayload(a.payload)}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function summarisePayload(payload: Record<string, unknown>): string {
  const reason = payload.reason;
  if (typeof reason === "string" && reason.length > 0) {
    return `"${reason}"`;
  }
  const decision = payload.decision;
  if (typeof decision === "string") return decision;
  return "";
}

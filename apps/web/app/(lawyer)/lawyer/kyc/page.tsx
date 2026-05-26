import {
  CheckCircle2,
  CircleDashed,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
import { KycForm } from "./form";

type KycResponse = {
  submission: {
    id: string;
    status: "draft" | "submitted" | "approved" | "rejected";
    rejectReason: string | null;
    submittedAt: string | null;
    decidedAt: string | null;
  } | null;
  documents: { kind: string; s3Key: string }[];
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function longDate(iso: string | null | undefined) {
  if (!iso) return null;
  return phDateFormat({
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_META: Record<
  "none" | "draft" | "submitted" | "approved" | "rejected",
  {
    label: string;
    icon: React.ReactNode;
    accent: string;
    tone: string;
  }
> = {
  none: {
    label: "Not submitted",
    icon: <CircleDashed className="size-3.5" />,
    accent: "bg-zinc-300",
    tone: "text-muted-foreground",
  },
  draft: {
    label: "Draft",
    icon: <CircleDashed className="size-3.5" />,
    accent: "bg-zinc-400",
    tone: "text-muted-foreground",
  },
  submitted: {
    label: "In review",
    icon: <Clock className="size-3.5" />,
    accent: "bg-amber-500",
    tone: "text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="size-3.5" />,
    accent: "bg-emerald-500",
    tone: "text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="size-3.5" />,
    accent: "bg-rose-500",
    tone: "text-rose-700 dark:text-rose-300",
  },
};

export default async function KycPage() {
  const kyc = await safe<KycResponse>("/lawyers/kyc", {
    submission: null,
    documents: [],
  });

  const statusKey: keyof typeof STATUS_META = kyc.submission
    ? (kyc.submission.status as keyof typeof STATUS_META)
    : "none";
  const meta = STATUS_META[statusKey];
  const allowResubmit = kyc.submission?.status !== "submitted";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Verification"
        title="KYC verification"
        summary="Upload a government ID, your bar certificate, and a selfie. We submit them to IDMeta for verification — you'll see status updates here."
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-inset",
              meta.tone,
            )}
          >
            <span className={cn("size-1.5 rounded-full", meta.accent)} aria-hidden />
            {meta.label}
          </span>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Upload tiles ----------------------------------------------- */}
        <div>
          <KycForm allowResubmit={!!allowResubmit} />
        </div>

        {/* Status + checklist ----------------------------------------- */}
        <aside className="space-y-4 lg:self-start">
          <Card size="sm" className="gap-3">
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current submission
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset ring-border/60",
                    meta.tone,
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", meta.accent)}
                    aria-hidden
                  />
                  {meta.label}
                </span>
              </div>
              {kyc.submission?.submittedAt ? (
                <div className="text-xs">
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="mt-0.5 tabular-nums">
                    {longDate(kyc.submission.submittedAt)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing submitted yet.
                </p>
              )}
              {kyc.submission?.decidedAt ? (
                <div className="text-xs">
                  <p className="text-muted-foreground">Decided</p>
                  <p className="mt-0.5 tabular-nums">
                    {longDate(kyc.submission.decidedAt)}
                  </p>
                </div>
              ) : null}
              {kyc.submission?.rejectReason ? (
                <div className="rounded-md border border-rose-200/60 bg-rose-50/40 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  <p className="text-[10px] font-semibold uppercase tracking-wider">
                    Reject reason
                  </p>
                  <p className="mt-0.5">{kyc.submission.rejectReason}</p>
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                {kyc.documents.length} document
                {kyc.documents.length === 1 ? "" : "s"} on file.
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="gap-2">
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                What we need
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <ChecklistItem
                label="Government ID"
                hint="PhilSys, driver's license, or passport"
              />
              <ChecklistItem
                label="Bar certificate"
                hint="Roll of attorneys / IBP membership"
              />
              <ChecklistItem
                label="Selfie"
                hint="Clear, front-facing, well-lit"
              />
              <div className="pt-2 mt-1 flex items-start gap-2 border-t border-border/60 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Documents stored encrypted at rest. We only share them with
                  IDMeta for verification.
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function ChecklistItem({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/40">
        <CheckCircle2 className="size-2.5 text-muted-foreground/60" />
      </span>
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

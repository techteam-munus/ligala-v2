import {
  CheckCircle2,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Undo2,
  UserCog,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";

type AuditAction =
  | "user_status_changed"
  | "user_role_changed"
  | "kyc_decided"
  | "kyc_force_approved"
  | "discount_code_removed"
  | "discount_code_created"
  | "invoice_refunded"
  | "invoice_voided"
  | "referral_force_decided"
  | "ibp_lawyer_added";

type Row = {
  log: {
    id: string;
    action: AuditAction;
    subjectType: string;
    subjectId: string;
    reason: string | null;
    payload: Record<string, unknown> | null;
    createdAt: string;
  };
  actorName: string;
  actorEmail: string;
};

const ACTION_META: Record<
  AuditAction,
  { label: string; icon: React.ReactNode; tone: "ok" | "warn" | "danger" | "info" }
> = {
  user_status_changed: {
    label: "User status changed",
    icon: <UserCog className="size-3" />,
    tone: "warn",
  },
  user_role_changed: {
    label: "User role changed",
    icon: <UserCog className="size-3" />,
    tone: "warn",
  },
  kyc_decided: {
    label: "KYC decision",
    icon: <ShieldCheck className="size-3" />,
    tone: "ok",
  },
  kyc_force_approved: {
    label: "KYC force-approved",
    icon: <ShieldCheck className="size-3" />,
    tone: "warn",
  },
  discount_code_removed: {
    label: "Discount code removed",
    icon: <Trash2 className="size-3" />,
    tone: "danger",
  },
  discount_code_created: {
    label: "Discount code created",
    icon: <Plus className="size-3" />,
    tone: "info",
  },
  invoice_refunded: {
    label: "Invoice refunded",
    icon: <Undo2 className="size-3" />,
    tone: "danger",
  },
  invoice_voided: {
    label: "Invoice voided",
    icon: <XCircle className="size-3" />,
    tone: "danger",
  },
  referral_force_decided: {
    label: "Referral force-decided",
    icon: <TriangleAlert className="size-3" />,
    tone: "warn",
  },
  ibp_lawyer_added: {
    label: "IBP lawyer added",
    icon: <Plus className="size-3" />,
    tone: "info",
  },
};

const TONE_CLASS: Record<
  "ok" | "warn" | "danger" | "info",
  { dot: string; text: string; ring: string }
> = {
  ok: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
  },
  warn: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/60 dark:ring-amber-900/40",
  },
  danger: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200/60 dark:ring-rose-900/40",
  },
  info: {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200/60 dark:ring-sky-900/40",
  },
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function longDate(iso: string) {
  return phDateFormat({
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return longDate(iso);
}

export default async function AdminAuditLogPage() {
  const { items } = await safe<{ items: Row[] }>("/admin/audit-log", {
    items: [],
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHero
        eyebrow="Admin · Compliance"
        title="Audit log"
        summary={
          items.length === 0
            ? "Append-only record of every admin action. Nothing logged yet."
            : `Showing the most recent ${items.length} admin action${items.length === 1 ? "" : "s"} — append-only.`
        }
      />

      <Card className="mt-6 gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <ScrollText className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Activity
            </p>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </div>
        </div>
        <CardContent className="px-4 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ScrollText className="size-5" />
              </span>
              <p className="text-sm font-medium">Nothing logged yet</p>
              <p className="text-xs text-muted-foreground">
                Admin actions will appear here append-only as they happen.
              </p>
            </div>
          ) : (
            <ol className="relative ml-2 space-y-5 border-l border-border/60 pl-6">
              {items.map((r) => (
                <AuditEvent key={r.log.id} row={r} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function AuditEvent({ row }: { row: Row }) {
  const meta = ACTION_META[row.log.action] ?? {
    label: row.log.action,
    icon: <CheckCircle2 className="size-3" />,
    tone: "info" as const,
  };
  const tone = TONE_CLASS[meta.tone];
  const payloadJson =
    row.log.payload && Object.keys(row.log.payload).length > 0
      ? JSON.stringify(row.log.payload)
      : null;

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[31px] top-1.5 size-2.5 rounded-full ring-4 ring-background",
          tone.dot,
        )}
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset",
                tone.text,
                tone.ring,
              )}
            >
              {meta.icon}
              {meta.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              <span className="text-muted-foreground/60">on</span>{" "}
              <span className="font-mono text-foreground/80">
                {row.log.subjectType}
              </span>
              <span className="text-muted-foreground/40 mx-1">·</span>
              <span className="font-mono text-foreground/60">
                {row.log.subjectId.slice(0, 8)}…
              </span>
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {row.actorName}
            </span>
            <span className="text-muted-foreground/60">
              {" "}
              · {row.actorEmail}
            </span>
          </p>
          {row.log.reason ? (
            <p className="mt-1.5 max-w-2xl rounded-md bg-muted/30 px-3 py-1.5 text-xs text-foreground/80">
              &ldquo;{row.log.reason}&rdquo;
            </p>
          ) : null}
          {payloadJson ? (
            <pre className="mt-1.5 max-w-2xl overflow-x-auto rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 font-mono text-[10px] leading-snug text-muted-foreground">
              {payloadJson}
            </pre>
          ) : null}
        </div>
        <span
          className="text-[11px] tabular-nums text-muted-foreground/80"
          title={longDate(row.log.createdAt)}
        >
          {relativeTime(row.log.createdAt)}
        </span>
      </div>
    </li>
  );
}

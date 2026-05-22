import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type CaseStatus =
  | "pending"
  | "declined"
  | "accepted"
  | "active"
  | "closed"
  | "cancelled";

export type CaseTypeKind = "paid" | "probono";

const STATUS_STYLE: Record<
  CaseStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/80 dark:ring-amber-900/40",
  },
  accepted: {
    label: "Accepted",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200/80 dark:ring-sky-900/40",
  },
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/80 dark:ring-emerald-900/40",
  },
  closed: {
    label: "Closed",
    dot: "bg-zinc-400",
    text: "text-zinc-600 dark:text-zinc-300",
    ring: "ring-zinc-200/70 dark:ring-zinc-700/50",
  },
  declined: {
    label: "Declined",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200/70 dark:ring-rose-900/40",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-zinc-300",
    text: "text-muted-foreground",
    ring: "ring-zinc-200/70 dark:ring-zinc-700/40",
  },
};

export function CaseStatusPill({
  status,
  className,
}: {
  status: CaseStatus | string;
  className?: string;
}) {
  const style = STATUS_STYLE[status as CaseStatus] ?? STATUS_STYLE.pending;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-transparent bg-background/40 px-2 text-[11px] font-medium tracking-tight ring-1 ring-inset",
        style.text,
        style.ring,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </Badge>
  );
}

export function CaseTypePill({
  kind,
  className,
}: {
  kind: CaseTypeKind | string;
  className?: string;
}) {
  if (kind === "probono") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-transparent bg-violet-500/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-inset ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-900/40",
          className,
        )}
      >
        Pro bono
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent bg-muted px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ring-1 ring-inset ring-border/60",
        className,
      )}
    >
      Paid
    </Badge>
  );
}

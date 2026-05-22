import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "void";

const STATUS_STYLE: Record<
  InvoiceStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-zinc-400",
    text: "text-zinc-600 dark:text-zinc-300",
    ring: "ring-zinc-200/70 dark:ring-zinc-700/50",
  },
  sent: {
    label: "Sent",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/80 dark:ring-amber-900/40",
  },
  partially_paid: {
    label: "Part. paid",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200/80 dark:ring-sky-900/40",
  },
  paid: {
    label: "Paid",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/80 dark:ring-emerald-900/40",
  },
  void: {
    label: "Void",
    dot: "bg-zinc-300",
    text: "text-muted-foreground line-through",
    ring: "ring-zinc-200/70 dark:ring-zinc-700/40",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: InvoiceStatus | string;
  className?: string;
}) {
  const style = STATUS_STYLE[status as InvoiceStatus] ?? STATUS_STYLE.draft;
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

export function isOverdue(
  dueAt: string | null | undefined,
  status: string,
  now: Date = new Date(),
): boolean {
  if (!dueAt) return false;
  if (status !== "sent" && status !== "partially_paid") return false;
  return new Date(dueAt).getTime() < now.getTime();
}

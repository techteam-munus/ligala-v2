import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { phDateFormat } from "@/lib/datetime";

function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Hello";
}

function firstNameOf(name: string | null | undefined, email: string): string {
  const n = name?.trim();
  if (n) return n.split(/\s+/)[0] ?? n;
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function DashboardHero({
  userName,
  userEmail,
  eyebrow,
  summary,
  actions,
}: {
  userName?: string | null;
  userEmail: string;
  /** Tiny uppercase chip above the greeting — e.g. "Lawyer · Dashboard". */
  eyebrow: string;
  /** One-line situational summary under the greeting. */
  summary?: ReactNode;
  /** Optional right-side actions (button row). */
  actions?: ReactNode;
}) {
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const firstName = firstNameOf(userName, userEmail);
  const dateLabel = phDateFormat({
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(now)
    .toUpperCase();

  return (
    <header className="border-b border-border/60 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {greeting},{" "}
            <span className="text-foreground">{firstName}</span>
            <span className="text-muted-foreground/60">.</span>
          </h1>
          {summary ? (
            <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 font-mono text-[10px] font-medium tracking-[0.18em] text-muted-foreground",
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            {dateLabel}
          </span>
          {actions}
        </div>
      </div>
    </header>
  );
}

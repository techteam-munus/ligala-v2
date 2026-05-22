import type { ReactNode } from "react";

/**
 * The standard header strip used on every lawyer/admin settings page:
 * tiny tracked eyebrow → big title → muted summary line → optional actions.
 * Ends in a hairline `border-b` so the body content reads as a separate
 * surface.
 */
export function PageHero({
  eyebrow,
  title,
  summary,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border/60 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          {summary ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{summary}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

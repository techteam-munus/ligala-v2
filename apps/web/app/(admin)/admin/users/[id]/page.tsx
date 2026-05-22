import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleDashed,
  ExternalLink,
  HeartHandshake,
  ScrollText,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserActions } from "./actions";

type User = {
  id: string;
  name: string;
  email: string;
  role: "client" | "lawyer" | "admin";
  status: "active" | "paused" | "banned";
  createdAt: string;
};

type LawyerProfile = {
  slug: string;
  bio: string | null;
  ibpChapterId: string | null;
  probonoAvailable: boolean;
} | null;

type Kyc = { id: string; status: string; createdAt: string }[];

type Audit = {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  reason: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}[];

type Resp = {
  user: User;
  lawyerProfile: LawyerProfile;
  clientProfile: unknown;
  kycSubmissions: Kyc;
  auditLog: Audit;
};

async function load(id: string): Promise<Resp | null> {
  try {
    return await api<Resp>(`/admin/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function tintFor(id: string): { bg: string; text: string; ring: string } {
  const palette = [
    {
      bg: "bg-sky-500/15",
      text: "text-sky-700 dark:text-sky-300",
      ring: "ring-sky-200/60 dark:ring-sky-900/40",
    },
    {
      bg: "bg-emerald-500/15",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
    },
    {
      bg: "bg-violet-500/15",
      text: "text-violet-700 dark:text-violet-300",
      ring: "ring-violet-200/60 dark:ring-violet-900/40",
    },
    {
      bg: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-200/60 dark:ring-amber-900/40",
    },
    {
      bg: "bg-rose-500/15",
      text: "text-rose-700 dark:text-rose-300",
      ring: "ring-rose-200/60 dark:ring-rose-900/40",
    },
  ] as const;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length]!;
}

function longDate(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
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

const ROLE_STYLE: Record<
  User["role"],
  { text: string; ring: string; dot: string }
> = {
  client: {
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
    dot: "bg-emerald-500",
  },
  lawyer: {
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200/60 dark:ring-sky-900/40",
    dot: "bg-sky-500",
  },
  admin: {
    text: "text-foreground",
    ring: "ring-foreground/30",
    dot: "bg-foreground",
  },
};

const STATUS_STYLE: Record<
  User["status"],
  { text: string; ring: string; dot: string }
> = {
  active: {
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
    dot: "bg-emerald-500",
  },
  paused: {
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/60 dark:ring-amber-900/40",
    dot: "bg-amber-500",
  },
  banned: {
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200/60 dark:ring-rose-900/40",
    dot: "bg-rose-500",
  },
};

const KYC_STATUS_STYLE: Record<
  string,
  { dot: string; text: string }
> = {
  approved: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  rejected: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
  submitted: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  draft: { dot: "bg-zinc-400", text: "text-muted-foreground" },
};

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { user, lawyerProfile, kycSubmissions, auditLog } = data;
  const tint = tintFor(user.id);
  const role = ROLE_STYLE[user.role];
  const status = STATUS_STYLE[user.status];

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All users
      </Link>

      {/* Hero --------------------------------------------------------- */}
      <header className="mt-3 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold ring-1 ring-inset",
                tint.bg,
                tint.text,
                tint.ring,
              )}
              aria-hidden
            >
              {initialsOf(user.name) || "?"}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Admin · User
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
                {user.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset capitalize",
                    role.text,
                    role.ring,
                  )}
                >
                  {user.role === "admin" ? (
                    <UserCog className="size-3" />
                  ) : (
                    <span
                      className={cn("size-1.5 rounded-full", role.dot)}
                      aria-hidden
                    />
                  )}
                  {user.role}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset capitalize",
                    status.text,
                    status.ring,
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", status.dot)}
                    aria-hidden
                  />
                  {user.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <CircleDashed className="mr-1 inline size-3" />
                Joined {longDate(user.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Body --------------------------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left ------------------------------------------------------- */}
        <div className="space-y-4">
          {lawyerProfile ? (
            <Card className="gap-0 py-0">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <UserCog className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Lawyer profile
                </p>
              </div>
              <CardContent className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Public slug
                    </p>
                    <p className="mt-0.5 font-mono text-sm">
                      /{lawyerProfile.slug}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/lawyers/${lawyerProfile.slug}` as never}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink />
                      View
                    </Link>
                  </Button>
                </div>
                {lawyerProfile.bio ? (
                  <p className="text-sm text-foreground/85">
                    {lawyerProfile.bio}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No bio set.
                  </p>
                )}
                {lawyerProfile.probonoAvailable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200/60 dark:text-violet-300 dark:ring-violet-900/40">
                    <HeartHandshake className="size-3" />
                    Accepts pro bono
                  </span>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* KYC submissions */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  KYC submissions
                </p>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {kycSubmissions.length}
                </span>
              </div>
            </div>
            <CardContent className="px-0 py-0">
              {kycSubmissions.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No submissions yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {kycSubmissions.map((s) => {
                    const sty =
                      KYC_STATUS_STYLE[s.status] ?? KYC_STATUS_STYLE.draft!;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              sty.dot,
                            )}
                            aria-hidden
                          />
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium capitalize",
                                sty.text,
                              )}
                            >
                              {s.status}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {s.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {longDate(s.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Audit log on this user */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <ScrollText className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Admin activity on this user
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {auditLog.length}
              </span>
            </div>
            <CardContent className="px-4 py-4">
              {auditLog.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No admin actions on this user yet.
                </p>
              ) : (
                <ol className="relative ml-2 space-y-4 border-l border-border/60 pl-5">
                  {auditLog.map((a) => (
                    <li key={a.id} className="relative">
                      <span
                        className="absolute -left-[27px] top-1.5 size-2 rounded-full bg-zinc-400 ring-4 ring-background"
                        aria-hidden
                      />
                      <p className="text-sm font-medium capitalize">
                        {a.action.replace(/_/g, " ")}
                      </p>
                      {a.reason ? (
                        <p className="mt-1 rounded-md bg-muted/30 px-2.5 py-1 text-[11px] text-foreground/85">
                          &ldquo;{a.reason}&rdquo;
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {longDate(a.createdAt)} · {timeOf(a.createdAt)} ·{" "}
                        {relativeTime(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail: actions ---------------------------------------- */}
        <aside className="lg:self-start">
          <UserActions
            userId={user.id}
            currentRole={user.role}
            currentStatus={user.status}
            forceVerifyEnabled={process.env.NODE_ENV !== "production"}
          />
        </aside>
      </div>
    </main>
  );
}

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { phDateFormat } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHero } from "@/app/_components/page-hero";

type User = {
  id: string;
  name: string;
  email: string;
  role: "client" | "lawyer" | "admin";
  status: "active" | "paused" | "banned";
  createdAt: string;
};

type Resp = { items: User[]; total: number; page: number; pageSize: number };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.length > 0) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const ROLE_STYLE: Record<
  User["role"],
  { dot: string; text: string; ring: string }
> = {
  client: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
  },
  lawyer: {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200/60 dark:ring-sky-900/40",
  },
  admin: {
    dot: "bg-foreground",
    text: "text-foreground",
    ring: "ring-foreground/30",
  },
};

const STATUS_STYLE: Record<
  User["status"],
  { dot: string; text: string; ring: string }
> = {
  active: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
  },
  paused: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/60 dark:ring-amber-900/40",
  },
  banned: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200/60 dark:ring-rose-900/40",
  },
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return phDateFormat({
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(d);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const q = pick("q") ?? "";
  const role = pick("role") ?? "";
  const status = pick("status") ?? "";
  const page = Number.parseInt(pick("page") ?? "1", 10) || 1;
  const pageSize = 25;

  const query = qs({
    q,
    role,
    status,
    page: String(page),
    pageSize: String(pageSize),
  });
  const resp = await safe<Resp>(`/admin/users${query}`, {
    items: [],
    total: 0,
    page,
    pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(resp.total / pageSize));
  const pageStart = resp.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(resp.total, pageStart + resp.items.length - 1);

  function pageHref(targetPage: number): string {
    return `/admin/users${qs({
      q,
      role,
      status,
      page: targetPage > 1 ? String(targetPage) : undefined,
    })}`;
  }

  const hasFilters = !!q || !!role || !!status;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Admin · Identity"
        title="Users"
        summary={
          resp.total === 0
            ? "No users yet."
            : `${resp.total.toLocaleString("en-PH")} total · click a row for KYC history and admin actions.`
        }
      />

      {/* Filter bar --------------------------------------------------- */}
      <Card size="sm" className="mt-6 gap-0 py-0">
        <CardContent className="px-2 py-2">
          <form className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search by name or email…"
                className="pl-9"
              />
            </div>
            <select name="role" defaultValue={role} className={SELECT_CLASS}>
              <option value="">All roles</option>
              <option value="client">Client</option>
              <option value="lawyer">Lawyer</option>
              <option value="admin">Admin</option>
            </select>
            <select name="status" defaultValue={status} className={SELECT_CLASS}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="banned">Banned</option>
            </select>
            <Button type="submit">Filter</Button>
            {hasFilters ? (
              <Button asChild variant="ghost">
                <Link href="/admin/users">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Table -------------------------------------------------------- */}
      <Card className="mt-4 gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              All users
            </p>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {resp.total}
            </span>
          </div>
          {resp.total > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {pageStart}–{pageEnd}
            </span>
          ) : null}
        </div>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  User
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-10 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resp.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={4}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    {hasFilters ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                          <Search className="size-5" />
                        </span>
                        <p className="font-medium">No users match</p>
                        <p className="text-xs">Try widening the filters.</p>
                      </div>
                    ) : (
                      "No users yet."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                resp.items.map((u) => (
                  <TableRow key={u.id} className="group transition-colors">
                    <TableCell className="pl-4 py-3">
                      <Link
                        href={`/admin/users/${u.id}` as never}
                        className="flex items-center gap-3"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-1 ring-inset ring-border/60">
                          {initialsOf(u.name) || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium group-hover:underline">
                            {u.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-3">
                      <RolePill role={u.role} />
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusPill status={u.status} />
                    </TableCell>
                    <TableCell className="pr-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                      {shortDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {resp.total > resp.pageSize ? (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pageStart}–{pageEnd} of {resp.total.toLocaleString("en-PH")}
              </span>
              <div className="flex items-center gap-1">
                {page <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft />
                    Prev
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(page - 1) as never}>
                      <ChevronLeft />
                      Prev
                    </Link>
                  </Button>
                )}
                <span className="px-2 tabular-nums">
                  {page} / {totalPages}
                </span>
                {page >= totalPages ? (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight />
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(page + 1) as never}>
                      Next
                      <ChevronRight />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function RolePill({ role }: { role: User["role"] }) {
  const style = ROLE_STYLE[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset capitalize",
        style.text,
        style.ring,
      )}
    >
      {role === "admin" ? (
        <UserCog className="size-3" />
      ) : (
        <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      )}
      {role}
    </span>
  );
}

function StatusPill({ status }: { status: User["status"] }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-0.5 text-[11px] font-medium tracking-tight ring-1 ring-inset capitalize",
        style.text,
        style.ring,
      )}
    >
      {status === "active" ? (
        <ShieldCheck className="size-3" />
      ) : (
        <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      )}
      {status}
    </span>
  );
}

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Scale,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHero } from "@/app/_components/page-hero";
import { AddIbpLawyerForm } from "./add-form";

type IbpLawyer = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  address: string;
  rollSigned: string;
  rollNumber: string;
  createdAt: string;
};

type Resp = {
  items: IbpLawyer[];
  total: number;
  page: number;
  pageSize: number;
};

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

function formatName(row: IbpLawyer): string {
  return [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ");
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export default async function AdminIbpLawyersPage({
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
  const page = Number.parseInt(pick("page") ?? "1", 10) || 1;
  const pageSize = 25;

  const query = qs({ q, page: String(page), pageSize: String(pageSize) });
  const resp = await safe<Resp>(`/admin/ibp-lawyers${query}`, {
    items: [],
    total: 0,
    page,
    pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(resp.total / pageSize));
  const pageStart = resp.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(resp.total, pageStart + resp.items.length - 1);

  function pageHref(targetPage: number): string {
    return `/admin/ibp-lawyers${qs({
      q,
      page: targetPage > 1 ? String(targetPage) : undefined,
    })}`;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Admin · Roll"
        title="IBP lawyers"
        summary={
          resp.total === 0
            ? "Directory of lawyers on the Roll of Attorneys. Nothing added yet."
            : `${resp.total.toLocaleString("en-PH")} on the Roll of Attorneys. Used to verify lawyer signups.`
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: filter + table ------------------------------------- */}
        <div className="space-y-4">
          {/* Filter bar */}
          <Card size="sm" className="gap-0 py-0">
            <CardContent className="px-2 py-2">
              <form className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[14rem]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="q"
                    defaultValue={q}
                    placeholder="Search by name or roll number…"
                    className="pl-9"
                  />
                </div>
                <Button type="submit">Filter</Button>
                {q ? (
                  <Button asChild variant="ghost">
                    <Link href="/admin/ibp-lawyers">Clear</Link>
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Scale className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Roll of Attorneys
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
              {resp.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <ScrollText className="size-5" />
                  </span>
                  <p className="text-sm font-medium">
                    {q ? "No matches" : "No IBP lawyers yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {q
                      ? "Try a different name or roll number."
                      : "Use the form on the right to add the first one."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 pl-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Name
                      </TableHead>
                      <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Roll #
                      </TableHead>
                      <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Signed
                      </TableHead>
                      <TableHead className="h-10 pr-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Address
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resp.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="pl-4 py-3 font-medium">
                          {formatName(row)}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-mono text-sm tabular-nums">
                            {row.rollNumber}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm tabular-nums text-muted-foreground">
                          {shortDate(row.rollSigned)}
                        </TableCell>
                        <TableCell className="pr-4 py-3 max-w-[24rem] truncate text-xs text-muted-foreground">
                          {row.address}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {resp.total > resp.pageSize ? (
                <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {pageStart}–{pageEnd} of{" "}
                    {resp.total.toLocaleString("en-PH")}
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
        </div>

        {/* Right: add form ------------------------------------------ */}
        <aside>
          <AddIbpLawyerForm />
        </aside>
      </div>
    </main>
  );
}

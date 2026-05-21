import Link from "next/link";
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

type Resp = { items: IbpLawyer[]; total: number; page: number; pageSize: number };

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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">IBP lawyers</h1>
      <p className="mt-2 text-muted-foreground">
        Directory of lawyers on the Roll of Attorneys. {resp.total} total.
      </p>

      <AddIbpLawyerForm />

      <Card className="mt-6 gap-0 py-3">
        <CardContent className="px-3">
          <form className="flex flex-wrap items-center gap-3">
            <Input
              name="q"
              defaultValue={q}
              placeholder="name or roll number"
              className="flex-1"
            />
            <Button type="submit" size="sm">
              Filter
            </Button>
            <Link
              href="/admin/ibp-lawyers"
              className="text-xs text-muted-foreground underline"
            >
              Reset
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          {resp.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No IBP lawyers yet. Use the form above to add the first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll number</TableHead>
                  <TableHead>Roll signed</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resp.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{formatName(row)}</TableCell>
                    <TableCell>{row.rollNumber}</TableCell>
                    <TableCell>{row.rollSigned}</TableCell>
                    <TableCell className="max-w-[24rem] truncate text-muted-foreground">
                      {row.address}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <Button asChild variant="ghost" size="sm" disabled={page <= 1}>
            <Link
              href={`/admin/ibp-lawyers${qs({ q, page: String(Math.max(1, page - 1)) })}` as never}
            >
              ← Previous
            </Link>
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="ghost" size="sm" disabled={page >= totalPages}>
            <Link
              href={`/admin/ibp-lawyers${qs({ q, page: String(Math.min(totalPages, page + 1)) })}` as never}
            >
              Next →
            </Link>
          </Button>
        </nav>
      ) : null}
    </main>
  );
}

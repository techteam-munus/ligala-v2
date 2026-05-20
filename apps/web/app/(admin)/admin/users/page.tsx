import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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

  const query = qs({ q, role, status, page: String(page), pageSize: String(pageSize) });
  const resp = await safe<Resp>(`/admin/users${query}`, {
    items: [],
    total: 0,
    page,
    pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(resp.total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-muted-foreground">{resp.total} total.</p>

      <Card className="mt-6 gap-0 py-3">
        <CardContent className="px-3">
          <form className="flex flex-wrap items-center gap-3">
            <Input
              name="q"
              defaultValue={q}
              placeholder="email or name"
              className="flex-1"
            />
            <select name="role" defaultValue={role} className={SELECT_CLASS}>
              <option value="">All roles</option>
              <option value="client">client</option>
              <option value="lawyer">lawyer</option>
              <option value="admin">admin</option>
            </select>
            <select name="status" defaultValue={status} className={SELECT_CLASS}>
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="banned">banned</option>
            </select>
            <Button type="submit" size="sm">
              Filter
            </Button>
            <Link href="/admin/users" className="text-xs text-muted-foreground underline">
              Reset
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          <ul className="divide-y">
            {resp.items.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <Link
                    href={`/admin/users/${u.id}` as never}
                    className="font-medium hover:underline"
                  >
                    {u.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{u.role}</Badge>
                  <Badge
                    variant="outline"
                    className={
                      u.status === "active"
                        ? "border-green-600 text-green-700"
                        : "border-amber-600 text-amber-700"
                    }
                  >
                    {u.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <Button asChild variant="ghost" size="sm" disabled={page <= 1}>
            <Link href={`/admin/users${qs({ q, role, status, page: String(Math.max(1, page - 1)) })}` as never}>
              ← Previous
            </Link>
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="ghost" size="sm" disabled={page >= totalPages}>
            <Link href={`/admin/users${qs({ q, role, status, page: String(Math.min(totalPages, page + 1)) })}` as never}>
              Next →
            </Link>
          </Button>
        </nav>
      ) : null}
    </main>
  );
}

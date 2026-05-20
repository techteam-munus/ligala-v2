import Link from "next/link";
import { api } from "@/lib/api";

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
      <p className="mt-2 text-neutral-600">{resp.total} total.</p>

      <form className="mt-6 flex flex-wrap gap-3 rounded border border-neutral-200 p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="email or name"
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <select
          name="role"
          defaultValue={role}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          <option value="client">client</option>
          <option value="lawyer">lawyer</option>
          <option value="admin">admin</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="banned">banned</option>
        </select>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Filter
        </button>
        <Link href="/admin/users" className="text-xs text-neutral-500 underline">
          Reset
        </Link>
      </form>

      <ul className="mt-6 divide-y divide-neutral-200 rounded border border-neutral-200">
        {resp.items.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div>
              <Link
                href={`/admin/users/${u.id}` as never}
                className="font-medium hover:underline"
              >
                {u.name}
              </Link>
              <p className="text-xs text-neutral-500">{u.email}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge>{u.role}</Badge>
              <Badge tone={u.status === "active" ? "ok" : "warn"}>{u.status}</Badge>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={`/admin/users${qs({ q, role, status, page: String(Math.max(1, page - 1)) })}` as never}
            className={page <= 1 ? "pointer-events-none text-neutral-300" : "underline"}
          >
            ← Previous
          </Link>
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/admin/users${qs({ q, role, status, page: String(Math.min(totalPages, page + 1)) })}` as never}
            className={page >= totalPages ? "pointer-events-none text-neutral-300" : "underline"}
          >
            Next →
          </Link>
        </nav>
      ) : null}
    </main>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const color =
    tone === "ok"
      ? "border-green-600 text-green-700"
      : tone === "warn"
        ? "border-amber-600 text-amber-700"
        : "border-neutral-300 text-neutral-700";
  return <span className={`rounded-full border px-2 py-0.5 ${color}`}>{children}</span>;
}

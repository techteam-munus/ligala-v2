import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

/**
 * Server-side fetch helper that forwards the incoming request's cookies to the
 * Hono API. Use ONLY from Server Components, Server Actions, and Route
 * Handlers — the browser cannot share cookies with localhost:8787 (different
 * origin), and we don't want it to.
 */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      cookie,
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText, path);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`api ${path} -> ${status}: ${body.slice(0, 200)}`);
    this.name = "ApiError";
  }
}

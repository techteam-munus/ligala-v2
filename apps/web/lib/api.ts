import { headers } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

/**
 * Server-side fetch helper that forwards the incoming request's cookies to the
 * Hono API. Use ONLY from Server Components, Server Actions, and Route
 * Handlers — the browser cannot share cookies with localhost:8787 (different
 * origin), and we don't want it to.
 *
 * `403 subscription_expired` is intercepted: instead of bubbling an error, we
 * redirect the request to `/lawyer/subscribe?from=expired`. This means any
 * lawyer-portal write action that hits the gate automatically lands the user
 * on the renewal page. The gate only fires on writes (GETs always pass), so
 * read-only pages never see this redirect.
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
    if (res.status === 403 && parseErrorCode(body) === "subscription_expired") {
      redirect("/lawyer/subscribe?from=expired");
    }
    throw new ApiError(res.status, body || res.statusText, path);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function parseErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    return typeof parsed.error === "string" ? parsed.error : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  public readonly code: string | null;
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`api ${path} -> ${status}: ${body.slice(0, 200)}`);
    this.name = "ApiError";
    this.code = parseErrorCode(body);
  }
}

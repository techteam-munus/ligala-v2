import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

// Session shape returned by Better Auth's `/auth/get-session` endpoint.
// Mirrors what `auth.api.getSession()` returned before the proxy refactor.
type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: "client" | "lawyer" | "admin";
  status?: "active" | "paused" | "banned";
  createdAt?: string;
  updatedAt?: string;
};

type SessionPayload = {
  session: {
    id: string;
    userId: string;
    expiresAt: string;
    token: string;
    [k: string]: unknown;
  };
  user: SessionUser;
};

/**
 * Resolve the current session via the API Lambda's Better Auth.
 *
 * Why proxy instead of running Better Auth on the web Lambda directly:
 * Amplify's Next.js Lambda lives outside our VPC and can't reach Aurora.
 * The API Lambda runs Better Auth in-VPC with full DB access; the web side
 * just forwards cookies and reads the result.
 *
 * Returns null when unauthenticated or when the API call fails. Server
 * Components / Server Actions / Route Handlers can call this safely.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const h = await headers();
  const cookie = h.get("cookie");
  if (!cookie) return null;
  try {
    const res = await fetch(`${API_URL}/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SessionPayload | null;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");
  return session;
}

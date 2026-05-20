import { auth } from "@ligala/auth";
import { headers } from "next/headers";

/**
 * Resolve the current session in a Server Component / Server Action / Route
 * Handler. Returns null when unauthenticated.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");
  return session;
}

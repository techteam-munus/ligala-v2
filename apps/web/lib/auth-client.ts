import { createAuthClient } from "better-auth/react";

// Used by client components for signIn/signUp/useSession. Server components
// resolve the session directly via `auth.api.getSession({ headers: ... })`.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "",
});

export const { signIn, signUp, signOut, useSession } = authClient;

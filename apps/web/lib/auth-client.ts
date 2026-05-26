import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Used by client components for signIn/signUp/useSession. Server components
// resolve the session directly via `auth.api.getSession({ headers: ... })`.
//
// `emailOTPClient` exposes `authClient.emailOtp.{sendVerificationOtp,verifyEmail}`
// — used by the /verify-email page to confirm the 6-digit code from signup.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "",
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

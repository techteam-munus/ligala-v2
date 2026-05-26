import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db, schema } from "@ligala/db";
import { dispatchEmail } from "@ligala/email";
import { buildVerificationCodeMessage, buildResetMessage } from "./email-hooks";
import { parseTrustedOrigins } from "./trusted-origins";

// Better Auth performs its own `process.env.BETTER_AUTH_SECRET` lookup at init,
// independent of the `secret` field below. Without a value it throws during
// Next.js's page-data collection step. Seed a placeholder so `next build`
// succeeds in environments where the secret isn't injected (e.g. CI building
// the artifact before it lands in a runtime env that does have the real one).
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET =
    "build-time-placeholder-secret-replace-in-production-environment-12345";
}

const trustedOrigins = parseTrustedOrigins(process.env.AUTH_TRUSTED_ORIGINS);

/**
 * Shared Better Auth instance — imported by both `apps/web` (mounted as a
 * Next.js catch-all route) and `apps/api` (mounted as a Hono catch-all). Both
 * sides read the same Drizzle DB and validate the same session cookie, so a
 * sign-in on the web app is immediately honored by the API.
 *
 * Env required at runtime:
 *   DATABASE_URL              postgres connection string
 *   BETTER_AUTH_SECRET        32+ char secret (openssl rand -base64 32)
 *   BETTER_AUTH_URL           public origin of the web app
 *   GOOGLE_CLIENT_ID          optional — Google OAuth disabled if missing
 *   GOOGLE_CLIENT_SECRET      optional
 */
export const auth = betterAuth({
  database: drizzleAdapter(db(), {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // Additional trusted origins for CSRF (custom domain + Amplify default, etc).
  // baseURL is always trusted; this only adds the others. Omitted when empty so
  // we don't override Better Auth's default.
  ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
  // Hono mounts this handler at /auth/* (apps/api/src/app.ts), not the Better
  // Auth default /api/auth. Setting basePath here makes route matching pick
  // up requests under /auth/*.
  basePath: "/auth",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.EMAIL_VERIFICATION_REQUIRED === "true",
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }: { user: { id: string; email: string; name?: string | null }; url: string }) => {
      await dispatchEmail(buildResetMessage(user, url));
    },
  },
  emailVerification: {
    // Trigger a verification send on sign-up. With the emailOTP plugin's
    // `overrideDefaultEmailVerification` below, this (and the
    // `requireEmailVerification` sign-in path) sends a 6-digit code instead of
    // a magic link. We deliberately DON'T define `sendVerificationEmail` here —
    // the plugin injects its own that routes through `sendVerificationOTP`.
    sendOnSignUp: true,
    // Once the code is confirmed, establish the session so the user lands in
    // their portal without a separate sign-in step.
    autoSignInAfterVerification: true,
  },
  plugins: [
    // Email verification by 6-digit code instead of a link.
    // `overrideDefaultEmailVerification` makes Better Auth's verification
    // machinery (sign-up + the `requireEmailVerification` sign-in gate) emit an
    // OTP via `sendVerificationOTP` rather than a link.
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        // Only email verification uses codes today; sign-in / password-reset
        // OTP flows are not enabled (password reset stays a link).
        if (type === "email-verification") {
          await dispatchEmail(buildVerificationCodeMessage(email, otp));
        }
      },
    }),
  ],
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "client",
        input: false,
      },
      // Phase 7. Admins toggle paused/banned via /admin/users/:id/status.
      // Marked input:false so end-users can't self-assign at signup.
      status: {
        type: "string",
        required: false,
        defaultValue: "active",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Cookie cache disabled: lets role updates (e.g. client -> lawyer) take
    // effect on the next request instead of waiting for the cache to expire.
    // Re-enable with a short maxAge (e.g. 30s) once role changes are routed
    // through Better Auth's own update path that invalidates the cache.
    cookieCache: { enabled: false },
  },
  advanced: {
    cookiePrefix: "ligala",
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];

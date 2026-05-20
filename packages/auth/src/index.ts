import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@ligala/db";

// Better Auth performs its own `process.env.BETTER_AUTH_SECRET` lookup at init,
// independent of the `secret` field below. Without a value it throws during
// Next.js's page-data collection step. Seed a placeholder so `next build`
// succeeds in environments where the secret isn't injected (e.g. CI building
// the artifact before it lands in a runtime env that does have the real one).
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET =
    "build-time-placeholder-secret-replace-in-production-environment-12345";
}

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
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
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
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: "ligala",
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];

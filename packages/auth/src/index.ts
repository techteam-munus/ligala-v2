// Phase 1 wires Better Auth here with the Drizzle adapter against @ligala/db.
// Both apps/web and apps/api import the same `auth` instance so session cookies
// validate identically on both sides.
//
// Sketch (will be filled in Phase 1):
//
//   import { betterAuth } from "better-auth";
//   import { drizzleAdapter } from "better-auth/adapters/drizzle";
//   import { db } from "@ligala/db";
//
//   export const auth = betterAuth({
//     database: drizzleAdapter(db(), { provider: "pg" }),
//     emailAndPassword: { enabled: true },
//     socialProviders: {
//       google: {
//         clientId: process.env.GOOGLE_CLIENT_ID!,
//         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//       },
//     },
//     user: { additionalFields: { role: { type: "string", defaultValue: "client" } } },
//   });

export const __phase = 0 as const;

import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env on its own — pull values from .env.local first
// (gitignored, contains real local-dev secrets) then .env (committed defaults
// if any). CI / prod injects via real env vars and these loads are no-ops.
loadEnv({ path: [".env.local", ".env"], quiet: true });

// `generate` only reads the schema, but `migrate`/`push`/`studio` need a live
// DB. Placeholder keeps generate runnable without a DB; real ops fail loudly
// at connection time.
const url =
  process.env.DATABASE_URL ?? "postgres://placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});

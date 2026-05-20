import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema, but `migrate`/`push`/`studio` need a live
// DB. Passing a placeholder keeps `pnpm db:generate` runnable without a DB
// while still failing loudly when something tries to connect.
const url = process.env.DATABASE_URL ?? "postgres://placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});

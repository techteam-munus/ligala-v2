import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

// Sentinel URL used when DATABASE_URL is unset. postgres-js lazy-connects, so
// constructing with this sentinel is harmless until something actually queries
// — at which point the bad URL fails loudly. We rely on this to keep
// `next build` page-data collection from crashing in CI environments where
// DATABASE_URL isn't injected.
const PLACEHOLDER_URL =
  "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder_db";

export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL ?? PLACEHOLDER_URL;
  // In Lambda we reuse the client across invocations; max=1 keeps the per-Lambda
  // connection footprint small so RDS Proxy can multiplex effectively.
  const client = postgres(url, { max: 1, prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

export type Database = ReturnType<typeof db>;

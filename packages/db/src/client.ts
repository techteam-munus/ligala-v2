import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  // In Lambda we reuse the client across invocations; max=1 keeps the per-Lambda
  // connection footprint small so RDS Proxy can multiplex effectively.
  const client = postgres(url, { max: 1, prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

export type Database = ReturnType<typeof db>;

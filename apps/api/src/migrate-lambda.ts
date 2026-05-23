import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, schema, seedData } from "@ligala/db";
import { bootstrapEnv } from "./lib/bootstrap-env";

type MigrateEvent = {
  /**
   * - "migrate" (default): apply outstanding migrations only.
   * - "migrate-and-seed": apply migrations, then upsert reference data
   *   (IBP chapters, practice areas, jurisdictions). Idempotent.
   */
  action?: "migrate" | "migrate-and-seed";
};

type MigrateResult = {
  ok: boolean;
  action: MigrateEvent["action"];
  migrationsApplied: number;
  seededChapters?: number;
  seededPracticeAreas?: number;
  seededJurisdictions?: number;
  durationMs: number;
};

export async function handler(
  event: MigrateEvent = {},
): Promise<MigrateResult> {
  const start = Date.now();
  const action = event.action ?? "migrate";

  await bootstrapEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is unset after bootstrap — check DB_MASTER_SECRET_ARN + DB_PROXY_ENDPOINT",
    );
  }

  const client = db();

  // SQL files are bundled next to this handler by apps/api/scripts/build.mjs.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(here, "drizzle");

  const appliedBefore = await countAppliedMigrations(client);
  await migrate(client, { migrationsFolder });
  const appliedAfter = await countAppliedMigrations(client);

  const result: MigrateResult = {
    ok: true,
    action,
    migrationsApplied: Math.max(0, appliedAfter - appliedBefore),
    durationMs: 0,
  };

  if (action === "migrate-and-seed") {
    await client
      .insert(schema.ibpChapters)
      .values(seedData.ibpChapters)
      .onConflictDoNothing();
    await client
      .insert(schema.practiceAreas)
      .values(seedData.practiceAreas)
      .onConflictDoNothing();
    await client
      .insert(schema.jurisdictions)
      .values(seedData.jurisdictions)
      .onConflictDoNothing();
    result.seededChapters = seedData.ibpChapters.length;
    result.seededPracticeAreas = seedData.practiceAreas.length;
    result.seededJurisdictions = seedData.jurisdictions.length;
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function countAppliedMigrations(
  client: ReturnType<typeof db>,
): Promise<number> {
  const tableCheck = await client.execute(sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    LIMIT 1
  `);
  if (tableCheck.length === 0) return 0;
  const rows = await client.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`,
  );
  return rows[0]?.n ?? 0;
}

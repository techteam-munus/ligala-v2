import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { db, schema, seedData } from "../src/index";

async function main() {
  const client = db();
  console.info(`[seed] inserting ${seedData.ibpChapters.length} IBP chapters`);
  await client
    .insert(schema.ibpChapters)
    .values(seedData.ibpChapters)
    .onConflictDoNothing();
  console.info(
    `[seed] inserting ${seedData.practiceAreas.length} practice areas`,
  );
  await client
    .insert(schema.practiceAreas)
    .values(seedData.practiceAreas)
    .onConflictDoNothing();
  console.info(`[seed] inserting ${seedData.jurisdictions.length} jurisdictions`);
  await client
    .insert(schema.jurisdictions)
    .values(seedData.jurisdictions)
    .onConflictDoNothing();
  console.info("[seed] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});

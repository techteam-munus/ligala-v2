/**
 * Bootstrap admin script. Promotes the user with the given email to `admin`.
 * Usage:
 *   pnpm --filter @ligala/db seed-admin techteam@mymunus.com
 *
 * Idempotent — re-running on an already-admin user is a no-op.
 * Required in dev to bootstrap the first admin (the /admin endpoints require
 * an existing admin to promote another). Production deploys should set
 * `LIGALA_BOOTSTRAP_ADMIN_EMAIL` and run this in a one-shot Lambda or task.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { eq } from "drizzle-orm";
import { db, schema } from "../src/index";

const email = process.argv[2] ?? process.env.LIGALA_BOOTSTRAP_ADMIN_EMAIL;
if (!email) {
  console.error("usage: seed-admin <email>");
  process.exit(1);
}

const conn = db();
const target = await conn.query.user.findFirst({
  where: eq(schema.user.email, email),
});
if (!target) {
  console.error(`no user with email ${email} — sign up via the app first`);
  process.exit(2);
}
if (target.role === "admin") {
  console.log(`${email} is already admin`);
  process.exit(0);
}
await conn
  .update(schema.user)
  .set({ role: "admin", updatedAt: new Date() })
  .where(eq(schema.user.id, target.id));
console.log(`promoted ${email} (${target.id}) to admin`);
process.exit(0);

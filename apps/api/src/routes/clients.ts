import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { roleAssignmentInput } from "@ligala/shared/schemas";
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { requireSession } from "../middleware/session";
import { slugify, withRandomSuffix } from "../lib/slug";

/**
 * Endpoints for the signed-in user's own account — independent of role.
 */
export const clients = new Hono()
  .use("*", requireSession)
  .get("/me", async (c) => {
    const user = c.get("user");
    return c.json({ user });
  })
  /**
   * Promote (or self-assign) a role. Today this is the only path from
   * role=client to role=lawyer. Idempotent: re-posting with the same role
   * is a no-op that returns the current user + (for lawyers) their profile.
   */
  .post("/role", zValidator("json", roleAssignmentInput), async (c) => {
    const user = c.get("user");
    const { role } = c.req.valid("json");
    const conn = db();

    if (role === "lawyer") {
      // Ensure the user row reflects the role and a lawyer_profile exists.
      await conn.update(schema.user).set({ role: "lawyer", updatedAt: new Date() }).where(eq(schema.user.id, user.id));

      const existing = await conn.query.lawyerProfiles.findFirst({
        where: eq(schema.lawyerProfiles.userId, user.id),
      });
      if (existing) {
        return c.json({ user: { ...user, role: "lawyer" }, profile: existing });
      }

      // Generate a unique slug starting from the user's name.
      const base = slugify(user.name ?? user.email ?? "lawyer");
      let slug = base;
      for (let i = 0; i < 5; i++) {
        const collision = await conn.query.lawyerProfiles.findFirst({
          where: eq(schema.lawyerProfiles.slug, slug),
        });
        if (!collision) break;
        slug = withRandomSuffix(base);
      }

      const [profile] = await conn
        .insert(schema.lawyerProfiles)
        .values({ userId: user.id, slug })
        .returning();
      return c.json({ user: { ...user, role: "lawyer" }, profile }, 201);
    }

    // role === "client" — demotion path.
    await conn.update(schema.user).set({ role: "client", updatedAt: new Date() }).where(eq(schema.user.id, user.id));
    return c.json({ user: { ...user, role: "client" } });
  });

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { ilike } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { ibpVerifyInput } from "@ligala/shared/schemas";

/**
 * Public (no session) endpoints used during signup. The verify-ibp endpoint
 * lets a prospective lawyer prove they're on the Roll of Attorneys before
 * creating credentials. The matched record id is returned to the web app,
 * which stores it in a signed cookie until step 2 (account creation +
 * claim) completes.
 */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export const signup = new Hono().post(
  "/verify-ibp",
  zValidator("json", ibpVerifyInput),
  async (c) => {
    const input = c.req.valid("json");
    const conn = db();
    const match = await conn.query.ibpLawyers.findFirst({
      where: ilike(schema.ibpLawyers.rollNumber, input.rollNumber.trim()),
    });
    if (!match) {
      throw new HTTPException(404, { message: "ibp_not_found" });
    }
    const namesMatch =
      normalize(match.firstName) === normalize(input.firstName) &&
      normalize(match.lastName) === normalize(input.lastName) &&
      normalize(match.middleName ?? "") === normalize(input.middleName ?? "");
    if (!namesMatch) {
      throw new HTTPException(409, { message: "ibp_name_mismatch" });
    }
    if (match.userId) {
      throw new HTTPException(409, { message: "ibp_already_claimed" });
    }
    return c.json({
      ibpLawyerId: match.id,
      firstName: match.firstName,
      middleName: match.middleName,
      lastName: match.lastName,
      rollNumber: match.rollNumber,
    });
  },
);

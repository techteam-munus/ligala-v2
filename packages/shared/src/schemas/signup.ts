import { z } from "zod";

/**
 * Step 1 of the lawyer signup flow: the user proves they are on the
 * Roll of Attorneys by entering their roll number plus full name. The
 * server matches against `ibp_lawyer`; on success it issues a signed
 * cookie that step 2 (account creation) consumes.
 */
export const ibpVerifyInput = z.object({
  rollNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),
});
export type IbpVerifyInput = z.infer<typeof ibpVerifyInput>;

/**
 * Body for `POST /accounts/claim-ibp`. The cookie issued in step 1 is
 * the source of truth for which IBP record this user is claiming —
 * the client passes the id through, the server re-validates that the
 * record exists and is still unclaimed.
 */
export const claimIbpInput = z.object({
  ibpLawyerId: z.string().min(1),
});
export type ClaimIbpInput = z.infer<typeof claimIbpInput>;

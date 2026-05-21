"use server";

import { redirect } from "next/navigation";
import {
  ibpVerifyInput,
  type IbpVerifyInput,
} from "@ligala/shared/schemas";
import { api, ApiError } from "@/lib/api";
import {
  clearIbpVerifiedCookie,
  readVerifiedIbp,
  setIbpVerifiedCookie,
  type VerifiedIbp,
} from "@/lib/ibp-verification-cookie";

type VerifyResponse = {
  ibpLawyerId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  rollNumber: string;
};

export type IbpVerificationResult =
  | { ok: true; lawyer: VerifiedIbp }
  | { ok: false; code: "not_found" | "name_mismatch" | "already_claimed" | "unknown"; message: string };

function mapError(err: unknown): IbpVerificationResult {
  if (err instanceof ApiError) {
    if (err.body.includes("ibp_not_found")) {
      return { ok: false, code: "not_found", message: "We couldn't find that lawyer on the IBP roll. Double-check the roll number." };
    }
    if (err.body.includes("ibp_name_mismatch")) {
      return { ok: false, code: "name_mismatch", message: "The name doesn't match the IBP record for that roll number." };
    }
    if (err.body.includes("ibp_already_claimed")) {
      return { ok: false, code: "already_claimed", message: "This IBP record is already associated with an account. Try logging in instead." };
    }
  }
  return { ok: false, code: "unknown", message: err instanceof Error ? err.message : "Verification failed." };
}

export async function verifyIbpForSignup(
  input: IbpVerifyInput,
): Promise<IbpVerificationResult> {
  const parsed = ibpVerifyInput.parse(input);
  try {
    const res = await api<VerifyResponse>("/signup/verify-ibp", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
    const lawyer: VerifiedIbp = {
      id: res.ibpLawyerId,
      firstName: res.firstName,
      middleName: res.middleName,
      lastName: res.lastName,
      rollNumber: res.rollNumber,
    };
    await setIbpVerifiedCookie(lawyer);
    return { ok: true, lawyer };
  } catch (err) {
    return mapError(err);
  }
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; code: "no_cookie" | "already_claimed" | "unknown"; message: string };

export async function claimIbpAndPromote(): Promise<ClaimResult> {
  const verified = await readVerifiedIbp();
  if (!verified) {
    return {
      ok: false,
      code: "no_cookie",
      message: "Your IBP verification has expired. Please verify again.",
    };
  }
  try {
    await api<{ ok: true }>("/accounts/claim-ibp", {
      method: "POST",
      body: JSON.stringify({ ibpLawyerId: verified.id }),
    });
    await clearIbpVerifiedCookie();
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.body.includes("ibp_already_claimed")) {
      await clearIbpVerifiedCookie();
      return {
        ok: false,
        code: "already_claimed",
        message: "That IBP record was just claimed by another account.",
      };
    }
    return {
      ok: false,
      code: "unknown",
      message: err instanceof Error ? err.message : "Could not finalize lawyer signup.",
    };
  }
}

export async function clearIbpVerification() {
  await clearIbpVerifiedCookie();
  redirect("/signup/lawyer");
}

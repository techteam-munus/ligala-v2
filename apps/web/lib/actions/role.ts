"use server";

import { redirect } from "next/navigation";
import { claimIbpAndPromote } from "@/lib/actions/signup-lawyer";

/**
 * Used by `/become-a-lawyer` (existing client account upgrading to lawyer).
 * Requires that the user has just completed IBP verification in the same
 * session — the signed cookie supplies the `ibpLawyerId` server-side.
 */
export async function becomeLawyer() {
  const result = await claimIbpAndPromote();
  if (!result.ok) {
    redirect(`/become-a-lawyer?error=${result.code}`);
  }
  redirect("/lawyer/dashboard");
}

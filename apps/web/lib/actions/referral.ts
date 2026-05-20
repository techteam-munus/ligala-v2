"use server";

import { revalidatePath } from "next/cache";
import {
  referralCreateInput,
  referralDecisionInput,
  referralLinkInput,
  referralLinkPatch,
  type ReferralCreateInput,
  type ReferralDecisionInput,
  type ReferralLinkInput,
  type ReferralLinkPatch,
} from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function createReferral(input: ReferralCreateInput) {
  const parsed = referralCreateInput.parse(input);
  await api("/referrals", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/referrals");
}

export async function decideOnReferral(id: string, input: ReferralDecisionInput) {
  const parsed = referralDecisionInput.parse(input);
  await api(`/referrals/${id}/decision`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/referrals");
}

export async function createReferralLink(input: ReferralLinkInput) {
  const parsed = referralLinkInput.parse(input);
  await api("/referrals/links", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/referral-links");
}

export async function patchReferralLink(id: string, input: ReferralLinkPatch) {
  const parsed = referralLinkPatch.parse(input);
  await api(`/referrals/links/${id}`, {
    method: "PATCH",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/referral-links");
}

export async function deleteReferralLink(id: string) {
  await api(`/referrals/links/${id}`, { method: "DELETE" });
  revalidatePath("/lawyer/referral-links");
}

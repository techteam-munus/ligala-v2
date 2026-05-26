// apps/web/lib/actions/payouts.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  payoutMethodInput,
  withdrawalInput,
  type PayoutMethodInput,
  type WithdrawalInput,
} from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function addPayoutMethod(input: PayoutMethodInput) {
  const parsed = payoutMethodInput.parse(input);
  await api("/lawyer/payouts/methods", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/payouts");
}

export async function deletePayoutMethod(id: string) {
  await api(`/lawyer/payouts/methods/${id}`, { method: "DELETE" });
  revalidatePath("/lawyer/payouts");
}

export async function requestWithdrawal(input: WithdrawalInput) {
  const parsed = withdrawalInput.parse(input);
  const res = await api<{ payout: { id: string; status: string } }>(
    "/lawyer/payouts",
    { method: "POST", body: JSON.stringify(parsed) },
  );
  revalidatePath("/lawyer/payouts");
  return res;
}

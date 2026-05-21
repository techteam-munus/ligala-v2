"use server";

import { revalidatePath } from "next/cache";
import {
  adminUserRoleInput,
  forceVerifyLawyerInput,
  ibpLawyerCreateInput,
  kycAdminDecisionInput,
  refundInput,
  userStatusInput,
  type AdminUserRoleInput,
  type ForceVerifyLawyerInput,
  type IbpLawyerCreateInput,
  type KycAdminDecisionInput,
  type RefundInput,
  type UserStatusInput,
} from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function setUserStatus(userId: string, input: UserStatusInput) {
  const parsed = userStatusInput.parse(input);
  await api(`/admin/users/${userId}/status`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, input: AdminUserRoleInput) {
  const parsed = adminUserRoleInput.parse(input);
  await api(`/admin/users/${userId}/role`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function decideOnKyc(submissionId: string, input: KycAdminDecisionInput) {
  const parsed = kycAdminDecisionInput.parse(input);
  await api(`/admin/kyc/${submissionId}/decision`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/admin/kyc");
}

export type ForceVerifyLawyerResult = {
  ok: true;
  alreadyVerified: boolean;
  submissionId?: string;
};

export async function forceVerifyLawyer(
  userId: string,
  input: ForceVerifyLawyerInput,
): Promise<ForceVerifyLawyerResult> {
  const parsed = forceVerifyLawyerInput.parse(input);
  const res = await api<ForceVerifyLawyerResult>(
    `/admin/users/${userId}/force-verify`,
    {
      method: "POST",
      body: JSON.stringify(parsed),
    },
  );
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/lawyers");
  return res;
}

export async function deleteDiscountCode(codeId: string, reason: string) {
  const q = `?reason=${encodeURIComponent(reason)}`;
  await api(`/admin/discount-codes/${codeId}${q}`, { method: "DELETE" });
  revalidatePath("/admin/discount-codes");
}

export async function refundInvoice(invoiceId: string, input: RefundInput) {
  const parsed = refundInput.parse(input);
  await api(`/admin/invoices/${invoiceId}/refund`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath(`/admin/invoices`);
}

export async function createIbpLawyer(input: IbpLawyerCreateInput) {
  const parsed = ibpLawyerCreateInput.parse(input);
  const res = await api<{ ok: true; id: string }>("/admin/ibp-lawyers", {
    method: "POST",
    body: JSON.stringify({
      ...parsed,
      rollSigned: parsed.rollSigned.toISOString().slice(0, 10),
    }),
  });
  revalidatePath("/admin/ibp-lawyers");
  return res;
}

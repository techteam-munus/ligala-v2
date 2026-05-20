"use server";

import { revalidatePath } from "next/cache";
import {
  adminUserRoleInput,
  kycAdminDecisionInput,
  refundInput,
  userStatusInput,
  type AdminUserRoleInput,
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

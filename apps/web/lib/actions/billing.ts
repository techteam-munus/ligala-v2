"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  applyDiscountInput,
  checkoutInput,
  discountCodeInput,
  invoiceCreateInput,
  invoicePatch,
  invoiceVoidInput,
  type ApplyDiscountInput,
  type CheckoutInput,
  type DiscountCodeInput,
  type InvoiceCreateInput,
  type InvoicePatch,
  type InvoiceVoidInput,
} from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function createInvoice(input: InvoiceCreateInput) {
  const parsed = invoiceCreateInput.parse(input);
  const res = await api<{ invoice: { id: string } }>("/billing/invoices", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  redirect(`/lawyer/invoices/${res.invoice.id}`);
}

export async function patchInvoice(id: string, input: InvoicePatch) {
  const parsed = invoicePatch.parse(input);
  await api(`/billing/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/invoices/${id}`);
}

export async function sendInvoice(id: string) {
  await api(`/billing/invoices/${id}/send`, { method: "POST" });
  revalidatePath(`/lawyer/invoices/${id}`);
  revalidatePath(`/invoices/${id}`);
}

export async function voidInvoice(id: string, input: InvoiceVoidInput) {
  const parsed = invoiceVoidInput.parse(input);
  await api(`/billing/invoices/${id}/void`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/invoices/${id}`);
}

export async function applyDiscount(id: string, input: ApplyDiscountInput) {
  const parsed = applyDiscountInput.parse(input);
  await api(`/billing/invoices/${id}/discount`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/lawyer/invoices/${id}`);
}

export async function checkoutInvoice(id: string, input: CheckoutInput) {
  const parsed = checkoutInput.parse(input);
  return await api<{ checkoutUrl: string; providerPaymentId: string; amountCents: number }>(
    `/billing/invoices/${id}/checkout`,
    {
      method: "POST",
      body: JSON.stringify(parsed),
    },
  );
}

export async function createDiscountCode(input: DiscountCodeInput) {
  const parsed = discountCodeInput.parse(input);
  await api("/billing/discount-codes", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/lawyer/discount-codes");
}

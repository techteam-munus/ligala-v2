"use server";

import {
  type SubscriptionDiscountPreviewDto,
  subscriptionCheckoutInput,
  subscriptionDiscountPreviewInput,
} from "@ligala/shared/schemas";
import { ApiError, api } from "@/lib/api";

type CheckoutSuccess = {
  ok: true;
  invoiceId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  checkoutUrl: string;
};

type CheckoutFailure = { ok: false; code: string; status: number };

/**
 * Returns a provider checkout URL for the lawyer's monthly subscription.
 * The caller (client component) handles the redirect/POST itself so dev
 * vs. real-provider flows can be branched on `provider` without a server
 * round-trip per branch.
 *
 * Returns a discriminated result so the client can show inline copy for
 * domain-level errors (invalid discount code, expired, etc.) without
 * depending on Next.js to forward thrown error messages.
 */
export async function startSubscriptionCheckout(
  provider: "paymongo" | "paypal" | "dev_simulate",
  discountCode?: string,
): Promise<CheckoutSuccess | CheckoutFailure> {
  const parsed = subscriptionCheckoutInput.parse({ provider, discountCode });
  try {
    const res = await api<{
      invoiceId: string;
      provider: string;
      providerPaymentId: string;
      amountCents: number;
      currency: string;
      checkoutUrl: string;
    }>("/lawyer/subscription/checkout", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        code: err.code ?? "request_failed",
        status: err.status,
      };
    }
    throw err;
  }
}

type PreviewSuccess = { ok: true } & SubscriptionDiscountPreviewDto;
type PreviewFailure = { ok: false; code: string; status: number };

/**
 * Preview the effect of applying a discount code against the lawyer's
 * current subscription price. Does not create or modify any invoice — pure
 * validation. Mirrors the rules used by /checkout so a successful preview
 * implies the same code will succeed at subscribe-time.
 */
export async function previewSubscriptionDiscount(
  code: string,
): Promise<PreviewSuccess | PreviewFailure> {
  const parsed = subscriptionDiscountPreviewInput.parse({ code });
  try {
    const res = await api<SubscriptionDiscountPreviewDto>(
      "/lawyer/subscription/discount/preview",
      { method: "POST", body: JSON.stringify(parsed) },
    );
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        code: err.code ?? "request_failed",
        status: err.status,
      };
    }
    throw err;
  }
}

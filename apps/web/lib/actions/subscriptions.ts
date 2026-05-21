"use server";

import { subscriptionCheckoutInput } from "@ligala/shared/schemas";
import { api } from "@/lib/api";

/**
 * Returns a provider checkout URL for the lawyer's monthly subscription.
 * The caller (client component) handles the redirect/POST itself so dev
 * vs. real-provider flows can be branched on `provider` without a server
 * round-trip per branch.
 */
export async function startSubscriptionCheckout(
  provider: "paymongo" | "paypal" | "dev_simulate",
) {
  const parsed = subscriptionCheckoutInput.parse({ provider });
  return await api<{
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
}

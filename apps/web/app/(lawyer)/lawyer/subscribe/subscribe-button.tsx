"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startSubscriptionCheckout } from "@/lib/actions/subscriptions";

/**
 * Single-button checkout. v1 always uses `dev_simulate` because PayMongo /
 * PayPal subscription integration isn't wired yet — the resulting URL is the
 * in-house simulate page that posts back to the webhook helper. When real
 * providers land, gate this on env / feature flag and surface their buttons.
 */
export function SubscribeButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    setError(null);
    start(async () => {
      try {
        const res = await startSubscriptionCheckout("dev_simulate");
        const r = await fetch(res.checkoutUrl, {
          method: "POST",
          credentials: "include",
        });
        if (!r.ok) throw new Error(`payment_failed (${r.status})`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div>
      <Button type="button" disabled={pending} onClick={subscribe}>
        {pending ? "Processing…" : label}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

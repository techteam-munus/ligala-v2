"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startSubscriptionCheckout } from "@/lib/actions/subscriptions";

/**
 * Real subscribe button. In production we always use PayMongo: we ask the api
 * for a hosted checkout URL and full-redirect to it. PayMongo handles
 * card / GCash / Maya / GrabPay and posts a signed webhook back to
 * /webhooks/paymongo on completion.
 *
 * The `dev_simulate` POST-and-refresh path is preserved when
 * `NODE_ENV !== "production"` AND the URL has `?simulate=1`, so Playwright
 * (which runs against `next dev`) can still drive the flow without hitting
 * PayMongo. Real lawyers never see this code path.
 */
export function SubscribeButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    setError(null);
    start(async () => {
      try {
        const simulate =
          process.env.NODE_ENV !== "production" &&
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("simulate") === "1";

        if (simulate) {
          const res = await startSubscriptionCheckout("dev_simulate");
          const r = await fetch(res.checkoutUrl, {
            method: "POST",
            credentials: "include",
          });
          if (!r.ok) throw new Error(`payment_failed (${r.status})`);
          router.refresh();
          return;
        }

        const res = await startSubscriptionCheckout("paymongo");
        window.location.assign(res.checkoutUrl);
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

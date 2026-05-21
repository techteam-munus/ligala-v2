"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  status: "success" | "cancelled";
  /** ISO string from server render — used as the baseline; once a poll sees a newer value, we know the webhook landed. */
  initialLastPaidAt: string | null;
};

/**
 * Renders the post-redirect status banner above the price card on
 * /lawyer/subscribe.
 *
 * `success` → "Processing your payment…" while we wait for the webhook;
 *   polls GET /lawyer/subscription every 2s for up to 10s. When `lastPaidAt`
 *   advances past the value we saw at server render time, we trigger
 *   router.refresh() so the rest of the page (price card, period end date)
 *   re-renders from the new server state, and we switch the copy to
 *   "Payment received".
 *
 * `cancelled` → muted "Payment cancelled" line; no polling.
 */
// If the SSR already saw a payment within this window before render, treat
// the page as already-resolved — the webhook landed before our HTML was
// rendered, so polling for "lastPaidAt advances past baseline" would never
// see a change. 60s comfortably covers the race between PayMongo's
// redirect and the inline webhook delivery.
const ALREADY_PAID_WINDOW_MS = 60_000;

function isRecentPayment(iso: string | null): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < ALREADY_PAID_WINDOW_MS;
}

export function PaymentStatusBanner({ status, initialLastPaidAt }: Props) {
  const router = useRouter();
  const [resolved, setResolved] = useState(() =>
    status === "success" && isRecentPayment(initialLastPaidAt),
  );
  const [gaveUp, setGaveUp] = useState(false);
  const baseline = useRef(initialLastPaidAt);

  useEffect(() => {
    if (status !== "success" || resolved) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const r = await fetch("/api/lawyer-subscription-snapshot", {
          credentials: "include",
        });
        if (r.ok) {
          const data = (await r.json()) as { lastPaidAt: string | null };
          if (data.lastPaidAt && data.lastPaidAt !== baseline.current) {
            if (!cancelled) {
              setResolved(true);
              router.refresh();
            }
            return;
          }
        }
      } catch {
        // ignore; we'll retry
      }
      if (attempts < 5 && !cancelled) {
        setTimeout(tick, 2_000);
      } else if (!cancelled) {
        setGaveUp(true);
      }
    };
    const id = setTimeout(tick, 2_000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [status, resolved, router]);

  if (status === "cancelled") {
    return (
      <div
        role="status"
        className="mb-6 rounded-md border border-muted bg-muted/30 p-4 text-sm text-muted-foreground"
      >
        Payment cancelled. You can try again anytime.
      </div>
    );
  }

  if (resolved) {
    return (
      <div
        role="status"
        className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
      >
        Payment received — your subscription is active.
      </div>
    );
  }

  if (gaveUp) {
    return (
      <div
        role="status"
        className="mb-6 rounded-md border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
      >
        We haven&apos;t received confirmation yet. Refresh the page in a moment —
        your payment will be reflected as soon as the provider notifies us.
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
    >
      Processing your payment… this usually takes a few seconds.
    </div>
  );
}

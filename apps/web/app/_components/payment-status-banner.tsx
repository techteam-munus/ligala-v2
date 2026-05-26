"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { reconcileInvoice } from "@/lib/actions/billing";

/**
 * Shown on the `?status=success` redirect back from PayMongo. PayMongo records
 * the payment asynchronously via a webhook that can lag (or, in local dev, never
 * arrive). This polls the reconcile endpoint — which pulls the checkout session
 * straight from PayMongo and records the payment if it settled — refreshing the
 * page until the invoice flips to paid. Renders nothing once settled.
 */
const MAX_ATTEMPTS = 6;
const INTERVAL_MS = 2500;

export function PaymentStatusBanner({
  invoiceId,
  settled,
}: {
  invoiceId: string;
  settled: boolean;
}) {
  const router = useRouter();
  const [resolved, setResolved] = useState(false);
  const [givenUp, setGivenUp] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (settled) {
      setResolved(true);
      return;
    }
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function tick() {
      attempts += 1;
      try {
        const res = await reconcileInvoice(invoiceId);
        if (!cancelled && (res?.status === "paid" || res?.status === "partially_paid")) {
          setResolved(true);
          router.refresh();
          return;
        }
      } catch {
        // Transient — keep polling; the webhook may still land.
      }
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        // Pick up anything the webhook recorded in the meantime, then stop.
        router.refresh();
        setGivenUp(true);
        return;
      }
      timer = setTimeout(tick, INTERVAL_MS);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [invoiceId, settled, router]);

  if (settled || resolved) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
        <CheckCircle2 className="size-4" />
        Payment received — thank you.
      </div>
    );
  }

  if (givenUp) {
    return (
      <div className="mb-4 rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        Still confirming your payment with the provider. This can take a moment —
        refresh the page shortly, or check back from the Invoices list.
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Processing your payment…
    </div>
  );
}

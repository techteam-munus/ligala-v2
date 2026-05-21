"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionDiscountPreviewDto } from "@ligala/shared/schemas";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  previewSubscriptionDiscount,
  startSubscriptionCheckout,
} from "@/lib/actions/subscriptions";

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
const DISCOUNT_ERROR_COPY: Record<string, string> = {
  code_not_found: "That code isn't valid.",
  code_not_yet_valid: "This code isn't active yet.",
  code_expired: "This code has expired.",
  code_exhausted: "This code has been used up.",
  subtotal_too_low: "This code doesn't apply to this plan.",
  discount_total_too_low:
    "After this discount the amount is below the minimum payable. Use a smaller code.",
};

function money(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}

export function SubscribeButton({
  actionLabel,
  priceCents,
}: {
  actionLabel: string;
  priceCents: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<SubscriptionDiscountPreviewDto | null>(
    null,
  );
  const [applying, startApplying] = useTransition();

  function apply() {
    const code = discountCode.trim().toUpperCase();
    if (!code) return;
    setDiscountCode(code);
    setDiscountError(null);
    setError(null);
    startApplying(async () => {
      const res = await previewSubscriptionDiscount(code);
      if (res.ok) {
        setApplied(res);
        return;
      }
      setApplied(null);
      setDiscountError(
        DISCOUNT_ERROR_COPY[res.code] ?? `${res.code} (${res.status})`,
      );
    });
  }

  function remove() {
    setApplied(null);
    setDiscountError(null);
    setDiscountCode("");
  }

  function subscribe() {
    setError(null);
    setDiscountError(null);
    const code =
      applied?.code ?? (discountCode.trim().toUpperCase() || undefined);
    start(async () => {
      try {
        const simulate =
          process.env.NODE_ENV !== "production" &&
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("simulate") === "1";

        const provider = simulate ? "dev_simulate" : "paymongo";
        const res = await startSubscriptionCheckout(provider, code);
        if (!res.ok) {
          if (DISCOUNT_ERROR_COPY[res.code]) {
            setApplied(null);
            setDiscountError(DISCOUNT_ERROR_COPY[res.code]!);
            return;
          }
          setError(`${res.code} (${res.status})`);
          return;
        }

        if (simulate) {
          const r = await fetch(res.checkoutUrl, {
            method: "POST",
            credentials: "include",
          });
          if (!r.ok) throw new Error(`payment_failed (${r.status})`);
          // Subscribe succeeded — drop the applied code so a second click
          // can't re-charge with the same code. (Real PayMongo redirects
          // away; this only matters on the simulate/router-refresh path.)
          setApplied(null);
          setDiscountCode("");
          router.refresh();
          return;
        }

        window.location.assign(res.checkoutUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const displayCents = applied?.totalCents ?? priceCents;
  const busy = pending || applying;

  return (
    <div className="flex flex-col gap-4">
      <Field data-invalid={discountError ? true : undefined}>
        <FieldLabel htmlFor="discount-code">Discount code (optional)</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="discount-code"
            value={discountCode}
            onChange={(e) => {
              if (applied) return;
              setDiscountCode(e.target.value);
              if (discountError) setDiscountError(null);
            }}
            placeholder="WELCOME50"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            className="flex-1 uppercase"
            aria-invalid={discountError ? true : undefined}
            disabled={busy || applied !== null}
            readOnly={applied !== null}
          />
          {applied ? (
            <Button
              type="button"
              variant="ghost"
              onClick={remove}
              disabled={busy}
            >
              Remove
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={apply}
              disabled={busy || !discountCode.trim()}
            >
              {applying ? "Checking…" : "Apply"}
            </Button>
          )}
        </div>
        {applied ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {applied.code} applied — you save {money(applied.discountCents)}
            {applied.kind === "percent" && applied.discountCents > 0
              ? ` (${Math.round(
                  (applied.discountCents / applied.originalCents) * 100,
                )}%)`
              : ""}
            . New total: <strong>{money(applied.totalCents)} / mo</strong>.
          </p>
        ) : (
          <FieldDescription>
            Have a promo code? Enter it and click Apply.
          </FieldDescription>
        )}
        {discountError ? <FieldError>{discountError}</FieldError> : null}
      </Field>

      <div>
        <Button type="button" disabled={busy} onClick={subscribe}>
          {pending
            ? "Processing…"
            : `${actionLabel} (${money(displayCents)} / mo)`}
        </Button>
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

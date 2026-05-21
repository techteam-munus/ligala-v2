import { describe, expect, it } from "vitest";
import type { DiscountCode } from "@ligala/db/schema";
import { validateDiscountCodeForSubscription } from "./subscription-discount";

const baseCode: DiscountCode = {
  id: "dc_test",
  lawyerId: "usr_admin",
  code: "WELCOME50",
  kind: "percent",
  valueBps: 5000,
  valueCents: null,
  minSubtotalCents: null,
  maxRedemptions: null,
  redemptions: 0,
  validFrom: null,
  validUntil: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const NOW = new Date("2026-05-22T12:00:00Z");

describe("validateDiscountCodeForSubscription", () => {
  it("applies a percent discount", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, kind: "percent", valueBps: 1500, valueCents: null },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: true, discountCents: 14985 });
  });

  it("applies a fixed discount", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, kind: "fixed", valueBps: null, valueCents: 10000 },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: true, discountCents: 10000 });
  });

  it("caps the discount at the subtotal", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, kind: "fixed", valueBps: null, valueCents: 200000 },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: true, discountCents: 99900 });
  });

  it("rejects when validFrom is in the future", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, validFrom: new Date("2026-06-01T00:00:00Z") },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "code_not_yet_valid" });
  });

  it("rejects when validUntil is in the past", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, validUntil: new Date("2026-05-01T00:00:00Z") },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "code_expired" });
  });

  it("rejects when maxRedemptions has been reached", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, maxRedemptions: 10, redemptions: 10 },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "code_exhausted" });
  });

  it("rejects when subtotal is below minSubtotalCents", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, minSubtotalCents: 100000 },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "subtotal_too_low" });
  });

  it("accepts when subtotal equals minSubtotalCents", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, kind: "percent", valueBps: 1000, minSubtotalCents: 99900 },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: true, discountCents: 9990 });
  });

  it("accepts when validFrom equals now", () => {
    const result = validateDiscountCodeForSubscription(
      { ...baseCode, validFrom: NOW },
      99900,
      NOW,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects expiry-window errors before redemption errors", () => {
    const result = validateDiscountCodeForSubscription(
      {
        ...baseCode,
        validUntil: new Date("2026-05-01T00:00:00Z"),
        maxRedemptions: 1,
        redemptions: 1,
      },
      99900,
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "code_expired" });
  });
});

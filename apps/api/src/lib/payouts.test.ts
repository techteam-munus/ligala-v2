import { describe, it, expect } from "vitest";
import {
  PAYOUT_FEE_CENTS,
  signedCents,
  computeBalance,
  clearsAtForEarning,
  type LedgerLine,
} from "./payouts";

const DAY = 86_400_000;

describe("signedCents", () => {
  it("is positive for credit, negative for debit", () => {
    expect(signedCents({ direction: "credit", amountCents: 100 })).toBe(100);
    expect(signedCents({ direction: "debit", amountCents: 100 })).toBe(-100);
  });
});

describe("clearsAtForEarning", () => {
  it("adds the clearing window in days", () => {
    const now = new Date("2026-05-26T00:00:00Z");
    expect(clearsAtForEarning(now, 3).toISOString()).toBe("2026-05-29T00:00:00.000Z");
  });
});

describe("computeBalance", () => {
  const now = new Date("2026-05-26T00:00:00Z");

  it("puts a fresh earning (and its fee) in pending, not available", () => {
    const future = new Date(now.getTime() + 3 * DAY);
    const lines: LedgerLine[] = [
      { direction: "credit", amountCents: 10000, clearsAt: future },
      { direction: "debit", amountCents: 300, clearsAt: future },
    ];
    expect(computeBalance(lines, now)).toEqual({ availableCents: 0, pendingCents: 9700 });
  });

  it("moves cleared earnings into available", () => {
    const past = new Date(now.getTime() - 1 * DAY);
    const lines: LedgerLine[] = [
      { direction: "credit", amountCents: 10000, clearsAt: past },
      { direction: "debit", amountCents: 300, clearsAt: past },
    ];
    expect(computeBalance(lines, now)).toEqual({ availableCents: 9700, pendingCents: 0 });
  });

  it("immediate debits (payout/refund) reduce available right away and can go negative", () => {
    const past = new Date(now.getTime() - 1 * DAY);
    const lines: LedgerLine[] = [
      { direction: "credit", amountCents: 10000, clearsAt: past },
      { direction: "debit", amountCents: 300, clearsAt: past },
      { direction: "debit", amountCents: 20000, clearsAt: now },
    ];
    expect(computeBalance(lines, now)).toEqual({ availableCents: -10300, pendingCents: 0 });
  });
});

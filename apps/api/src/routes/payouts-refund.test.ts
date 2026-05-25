import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertValues, mockInsert, mockDb, paymentRow, invoiceRow } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  const paymentRow = { id: "pay_1", invoiceId: "inv_1", status: "succeeded", amountCents: 10000, refundedCents: 0, currency: "PHP" };
  const invoiceRow = { id: "inv_1", number: "INV-1", kind: "case", lawyerId: "law_1", paidCents: 10000, totalCents: 10000, paidAt: new Date() };
  const mockDb = {
    query: {
      payments: { findFirst: vi.fn().mockResolvedValue(paymentRow) },
      invoices: { findFirst: vi.fn().mockResolvedValue(invoiceRow) },
      balanceEntries: { findFirst: vi.fn().mockResolvedValue({ amountCents: 300 }) },
    },
    insert: mockInsert,
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  };
  return { mockInsertValues, mockInsert, mockDb, paymentRow, invoiceRow };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: { payments: {}, invoices: {}, transactions: {}, balanceEntries: { relatedPaymentId: "related_payment_id", kind: "kind" } },
}));
vi.mock("../lib/env", () => ({ env: () => ({ PAYOUT_CLEARING_DAYS: 3, BETTER_AUTH_URL: "https://app.test" }) }));
vi.mock("@ligala/email", () => ({ dispatchEmail: vi.fn() }));

import { refundPayment } from "./billing";

describe("refundPayment — balance reversal", () => {
  beforeEach(() => {
    mockInsertValues.mockClear();
    mockInsert.mockClear();
    invoiceRow.kind = "case";
  });
  it("inserts a refund_reversal for the net credited", async () => {
    await refundPayment({ paymentId: "pay_1", amountCents: 10000 });
    const rev = mockInsertValues.mock.calls.map((c) => c[0]).find((v) => v?.kind === "refund_reversal");
    expect(rev?.amountCents).toBe(9700);
  });
  it("writes NO refund_reversal for a subscription invoice", async () => {
    invoiceRow.kind = "subscription";
    await refundPayment({ paymentId: "pay_1", amountCents: 10000 });
    const rev = mockInsertValues.mock.calls.map((c) => c[0]).find((v) => v?.kind === "refund_reversal");
    expect(rev).toBeUndefined();
  });
});

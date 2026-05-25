import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertValues, mockInsert, mockDb, mockEnvState, invoiceRow } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  const invoiceRow = {
    kind: "case", id: "inv_1", number: "INV-1", lawyerId: "law_1", clientId: "cli_1",
    currency: "PHP", totalCents: 10000, paidCents: 0, appliedDiscountCodeId: null,
  };
  const mockEnvState = { PAYOUT_CLEARING_DAYS: 3, BETTER_AUTH_URL: "https://app.test" };
  const mockDb = {
    query: {
      invoices: { findFirst: vi.fn().mockResolvedValue(invoiceRow) },
      payments: { findFirst: vi.fn().mockResolvedValue(undefined) },
      discountCodes: { findFirst: vi.fn().mockResolvedValue(null) },
      lawyerSubscriptions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      user: { findFirst: vi.fn().mockResolvedValue({ email: "c@x.test", name: "C" }) },
    },
    insert: mockInsert,
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  };
  return { mockInsertValues, mockInsert, mockDb, mockEnvState, invoiceRow };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: {
    invoices: {}, payments: {}, transactions: {}, discountCodes: {},
    lawyerSubscriptions: {}, user: {}, balanceEntries: {},
  },
}));
vi.mock("../lib/env", () => ({ env: () => mockEnvState }));
vi.mock("@ligala/email", () => ({ dispatchEmail: vi.fn().mockResolvedValue(undefined) }));

import { applyPaymentWebhook } from "./billing";

describe("applyPaymentWebhook — lawyer earnings", () => {
  beforeEach(() => {
    mockInsertValues.mockClear();
    mockInsert.mockClear();
    invoiceRow.kind = "case";
  });

  function entriesInserted() {
    return mockInsertValues.mock.calls
      .map((c) => c[0])
      .filter((v) => v && (v.kind === "earning" || v.kind === "processing_fee"));
  }

  it("writes earning + processing_fee for a case invoice", async () => {
    await applyPaymentWebhook({
      provider: "paymongo", providerPaymentId: "pay_1", invoiceId: "inv_1",
      status: "succeeded", amountCents: 10000, feeCents: 300,
    });
    const entries = entriesInserted();
    expect(entries.find((e) => e.kind === "earning")?.amountCents).toBe(10000);
    expect(entries.find((e) => e.kind === "processing_fee")?.amountCents).toBe(300);
  });

  it("writes NO balance entries for a subscription invoice", async () => {
    invoiceRow.kind = "subscription";
    await applyPaymentWebhook({
      provider: "paymongo", providerPaymentId: "pay_2", invoiceId: "inv_1",
      status: "succeeded", amountCents: 10000, feeCents: 300,
    });
    expect(entriesInserted()).toHaveLength(0);
  });
});

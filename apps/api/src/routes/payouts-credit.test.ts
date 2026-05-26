import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInsertValues,
  mockInsert,
  mockUpdateWhere,
  mockUpdateSet,
  mockUpdate,
  mockTransaction,
  mockDispatchEmail,
  mockDb,
  mockEnvState,
  invoiceRow,
} = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  const mockUpdateWhere = vi.fn().mockResolvedValue([]);
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const invoiceRow = {
    kind: "case", id: "inv_1", number: "INV-1", lawyerId: "law_1", clientId: "cli_1",
    currency: "PHP", totalCents: 10000, paidCents: 0, appliedDiscountCodeId: null,
  };
  const mockEnvState = { PAYOUT_CLEARING_DAYS: 3, BETTER_AUTH_URL: "https://app.test" };
  const mockDispatchEmail = vi.fn().mockResolvedValue(undefined);
  const mockDb = {
    query: {
      invoices: { findFirst: vi.fn().mockResolvedValue(invoiceRow) },
      payments: { findFirst: vi.fn().mockResolvedValue(undefined) },
      discountCodes: { findFirst: vi.fn().mockResolvedValue(null) },
      lawyerSubscriptions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      user: { findFirst: vi.fn().mockResolvedValue({ email: "c@x.test", name: "C" }) },
    },
    insert: mockInsert,
    update: mockUpdate,
    // Transparent transaction: invoke the callback with the same db handle so
    // tx.insert/tx.update/tx.query resolve to the mocks above.
    transaction: vi.fn(async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)),
  };
  return {
    mockInsertValues, mockInsert, mockUpdateWhere, mockUpdateSet, mockUpdate,
    mockTransaction: mockDb.transaction, mockDispatchEmail, mockDb, mockEnvState, invoiceRow,
  };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: {
    invoices: {}, payments: {}, transactions: {}, discountCodes: {},
    lawyerSubscriptions: {}, user: {}, balanceEntries: {},
  },
}));
vi.mock("../lib/env", () => ({ env: () => mockEnvState }));
vi.mock("@ligala/email", () => ({ dispatchEmail: mockDispatchEmail }));

import { applyPaymentWebhook } from "./billing";

describe("applyPaymentWebhook — lawyer earnings", () => {
  beforeEach(() => {
    mockInsertValues.mockReset().mockResolvedValue([]);
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockTransaction.mockClear();
    mockDispatchEmail.mockClear().mockResolvedValue(undefined);
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
    const earning = entries.find((e) => e.kind === "earning");
    const fee = entries.find((e) => e.kind === "processing_fee");
    expect(earning?.direction).toBe("credit");
    expect(earning?.relatedPaymentId).toBeTypeOf("string");
    expect(earning?.relatedPaymentId).toBeTruthy();
    expect(fee?.direction).toBe("debit");
    expect(fee?.relatedPaymentId).toBeTypeOf("string");
    expect(fee?.relatedPaymentId).toBeTruthy();
    // Both entries must link to the same internal payment row.
    expect(earning?.relatedPaymentId).toBe(fee?.relatedPaymentId);
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

describe("applyPaymentWebhook — atomicity", () => {
  beforeEach(() => {
    mockInsertValues.mockReset().mockResolvedValue([]);
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockTransaction.mockClear();
    mockDispatchEmail.mockClear().mockResolvedValue(undefined);
    invoiceRow.kind = "case";
  });

  it("wraps the payment + ledger + invoice writes in a single transaction", async () => {
    await applyPaymentWebhook({
      provider: "paymongo", providerPaymentId: "pay_atomic", invoiceId: "inv_1",
      status: "succeeded", amountCents: 10000, feeCents: 300,
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("a failing balance-entry insert aborts before the invoice update and sends no email", async () => {
    // Make ONLY the `earning` balance-entry insert reject (it runs after the
    // payment + charge inserts but BEFORE the invoice paidCents/status update).
    mockInsertValues.mockImplementation((row: { kind?: string } | undefined) => {
      if (row?.kind === "earning") return Promise.reject(new Error("balance insert failed"));
      return Promise.resolve([]);
    });

    await expect(
      applyPaymentWebhook({
        provider: "paymongo", providerPaymentId: "pay_fail", invoiceId: "inv_1",
        status: "succeeded", amountCents: 10000, feeCents: 300,
      }),
    ).rejects.toThrow("balance insert failed");

    // The throw happened inside the transaction (which real drizzle rolls back),
    // before the invoice update — so paidCents is never bumped...
    expect(mockUpdate).not.toHaveBeenCalled();
    // ...and the receipt email (deferred to after commit) is never dispatched.
    expect(mockDispatchEmail).not.toHaveBeenCalled();
  });
});

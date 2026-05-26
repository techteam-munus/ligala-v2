/**
 * Tests POST /billing/invoices/:id/reconcile — the success-redirect fallback
 * that pulls the PayMongo checkout session and records the payment when the
 * async webhook hasn't arrived. Keeps the pure `checkoutSessionPayment` parser
 * real (importActual); only the network retrieve + DB are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type * as PaymongoModule from "../lib/paymongo";

const {
  mockRetrieve,
  mockInsert,
  mockInsertValues,
  mockUpdate,
  mockTransaction,
  mockInvoiceFindFirst,
  mockPaymentsFindFirst,
  mockUserFindFirst,
  mockDb,
  stubRequireSession,
  CLIENT_ID,
  INVOICE_ID,
} = vi.hoisted(() => {
  const CLIENT_ID = "cli_1";
  const INVOICE_ID = "inv_1";
  const mockRetrieve = vi.fn();
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) }));
  const mockInvoiceFindFirst = vi.fn();
  const mockPaymentsFindFirst = vi.fn().mockResolvedValue(undefined);
  const mockUserFindFirst = vi.fn().mockResolvedValue({ email: "c@x.test", name: "C" });
  const mockDb = {
    query: {
      invoices: { findFirst: mockInvoiceFindFirst },
      payments: { findFirst: mockPaymentsFindFirst },
      discountCodes: { findFirst: vi.fn().mockResolvedValue(null) },
      lawyerSubscriptions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      user: { findFirst: mockUserFindFirst },
    },
    insert: mockInsert,
    update: mockUpdate,
    transaction: vi.fn(async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)),
  };
  const stubRequireSession = vi.fn(async (c: any, next: any) => {
    c.set("user", { id: CLIENT_ID, role: "client", email: "c@x.test", name: "C", status: "active" });
    await next();
  });
  return {
    mockRetrieve, mockInsert, mockInsertValues, mockUpdate,
    mockTransaction: mockDb.transaction, mockInvoiceFindFirst, mockPaymentsFindFirst,
    mockUserFindFirst, mockDb, stubRequireSession, CLIENT_ID, INVOICE_ID,
  };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: {
    invoices: {}, invoiceLines: {}, payments: {}, transactions: {},
    discountCodes: {}, lawyerSubscriptions: {}, user: {}, balanceEntries: {},
  },
}));
vi.mock("../lib/env", () => ({
  env: () => ({ PAYMONGO_SECRET_KEY: "sk_test_x", PAYOUT_CLEARING_DAYS: 3, BETTER_AUTH_URL: "https://app.test" }),
}));
vi.mock("@ligala/email", () => ({ dispatchEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../middleware/session", () => ({
  requireSession: stubRequireSession,
  requireRole: () => stubRequireSession,
}));
// Keep pure parser + errors real; only stub the network retrieve.
vi.mock("../lib/paymongo", async (importActual) => {
  const actual = await importActual<typeof PaymongoModule>();
  return { ...actual, retrieveCheckoutSession: mockRetrieve };
});

import { billing } from "./billing";

function app() {
  return new Hono().route("/billing", billing);
}

const SENT_INVOICE = {
  id: INVOICE_ID, number: "INV-1", kind: "case", status: "sent",
  clientId: CLIENT_ID, lawyerId: "law_1", currency: "PHP",
  totalCents: 10000, paidCents: 0, appliedDiscountCodeId: null,
  paymongoCheckoutSessionId: "cs_test_1", paidAt: null,
};

describe("POST /billing/invoices/:id/reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue([]);
    mockPaymentsFindFirst.mockResolvedValue(undefined);
    mockUserFindFirst.mockResolvedValue({ email: "c@x.test", name: "C" });
  });

  it("records the payment when the session shows a paid payment", async () => {
    // reconcile initial read, applyPaymentWebhook read, reconcile fresh re-read
    mockInvoiceFindFirst
      .mockResolvedValueOnce(SENT_INVOICE)
      .mockResolvedValueOnce(SENT_INVOICE)
      .mockResolvedValueOnce({ ...SENT_INVOICE, status: "paid", paidCents: 10000 });
    mockRetrieve.mockResolvedValue({
      id: "cs_test_1",
      attributes: {
        metadata: { invoiceId: INVOICE_ID },
        payments: [{ id: "pay_1", attributes: { amount: 10000, fee: 250, status: "paid" } }],
      },
    });

    const res = await app().request(`/billing/invoices/${INVOICE_ID}/reconcile`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reconciled: true, status: "paid" });

    // A payment row was inserted via the (idempotent) applyPaymentWebhook,
    // keyed on the cs_ id so it dedups with the webhook.
    const inserted = mockInsertValues.mock.calls.map((c) => c[0]);
    const paymentInsert = inserted.find((v) => v?.providerPaymentId === "cs_test_1");
    expect(paymentInsert).toMatchObject({ provider: "paymongo", status: "succeeded", amountCents: 10000 });
  });

  it("does nothing when the session is not yet paid", async () => {
    mockInvoiceFindFirst.mockResolvedValue(SENT_INVOICE);
    mockRetrieve.mockResolvedValue({
      id: "cs_test_1",
      attributes: { metadata: { invoiceId: INVOICE_ID }, payments: [{ attributes: { status: "awaiting_payment_method" } }] },
    });

    const res = await app().request(`/billing/invoices/${INVOICE_ID}/reconcile`, { method: "POST" });
    expect(await res.json()).toEqual({ reconciled: false, status: "sent" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("ignores a session whose metadata points at a different invoice", async () => {
    mockInvoiceFindFirst.mockResolvedValue(SENT_INVOICE);
    mockRetrieve.mockResolvedValue({
      id: "cs_test_1",
      attributes: { metadata: { invoiceId: "someone_else" }, payments: [{ attributes: { amount: 10000, status: "paid" } }] },
    });

    const res = await app().request(`/billing/invoices/${INVOICE_ID}/reconcile`, { method: "POST" });
    expect(await res.json()).toEqual({ reconciled: false, status: "sent" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("is a no-op (no provider call) when there is no stored session id", async () => {
    mockInvoiceFindFirst.mockResolvedValue({ ...SENT_INVOICE, paymongoCheckoutSessionId: null });

    const res = await app().request(`/billing/invoices/${INVOICE_ID}/reconcile`, { method: "POST" });
    expect(await res.json()).toEqual({ reconciled: false, status: "sent" });
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it("returns unchanged (no 5xx) when PayMongo retrieve fails", async () => {
    mockInvoiceFindFirst.mockResolvedValue(SENT_INVOICE);
    mockRetrieve.mockRejectedValue(new Error("network"));

    const res = await app().request(`/billing/invoices/${INVOICE_ID}/reconcile`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reconciled: false, status: "sent" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("403s when the caller is not the owning client", async () => {
    mockInvoiceFindFirst.mockResolvedValue({ ...SENT_INVOICE, clientId: "other_client" });

    const res = await app().request(`/billing/invoices/${INVOICE_ID}/reconcile`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });
});

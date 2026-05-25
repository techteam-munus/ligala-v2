/**
 * Tests that the /billing/invoices/:id/send route enqueues an invoice_sent
 * email via dispatchEmail with the correct kind + dedupeKey.
 *
 * Harness mirrors dev-verify.test.ts: vi.hoisted for shared state, vi.mock
 * factories that only reference hoisted values to avoid TDZ errors.
 *
 * Mocked: @ligala/db, @ligala/email, ../lib/env, ../lib/format,
 *         ../middleware/session, ../lib/billing, ../lib/subscription,
 *         ../lib/paymongo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// vi.hoisted: values referenced inside vi.mock factories.
// ---------------------------------------------------------------------------

const {
  mockDispatchEmail,
  mockEnvState,
  mockFindFirst,
  mockUpdateWhere,
  mockUpdateSet,
  mockUpdate,
  mockDb,
  stubRequireSession,
  stubRequireRole,
  FAKE_LAWYER_ID,
  FAKE_CLIENT_ID,
  FAKE_INVOICE_ID,
  FAKE_INVOICE_NUMBER,
} = vi.hoisted(() => {
  const FAKE_LAWYER_ID = "usr_lawyer";
  const FAKE_CLIENT_ID = "usr_client";
  const FAKE_INVOICE_ID = "inv_abc";
  const FAKE_INVOICE_NUMBER = "INV-001";

  const mockDispatchEmail = vi.fn().mockResolvedValue(undefined);

  const mockEnvState = {
    BETTER_AUTH_URL: "https://app.test",
    EMAIL_QUEUE_URL: undefined as string | undefined,
  };

  // Stub session middleware — injects a lawyer user.
  const stubRequireSession = vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: FAKE_LAWYER_ID,
      name: "Atty. Juan Dela Cruz",
      email: "lawyer@example.com",
      emailVerified: true,
      image: null,
      role: "lawyer",
      status: "active",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });
    await next();
  });

  const stubRequireRole = () => stubRequireSession;

  // DB mock chain: db().query.<table>.findFirst / db().update().set().where()
  const mockUpdateWhere = vi.fn().mockResolvedValue([]);
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // findFirst is called for the send route:
  //   1st: load the invoice
  //   2nd: load the client user (lawyer comes from the session user, no extra lookup)
  // We return a different value per call using a counter via mockImplementation.
  const mockFindFirst = vi.fn();

  const mockDb = vi.fn().mockReturnValue({
    query: {
      invoices: { findFirst: mockFindFirst },
      user: { findFirst: mockFindFirst },
    },
    update: mockUpdate,
  });

  return {
    mockDispatchEmail,
    mockEnvState,
    mockFindFirst,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockDb,
    stubRequireSession,
    stubRequireRole,
    FAKE_LAWYER_ID,
    FAKE_CLIENT_ID,
    FAKE_INVOICE_ID,
    FAKE_INVOICE_NUMBER,
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@ligala/email", () => ({
  dispatchEmail: mockDispatchEmail,
}));

vi.mock("../lib/env", () => ({
  env: () => mockEnvState,
}));

vi.mock("@ligala/db", () => ({
  db: mockDb,
  schema: {
    invoices: {
      id: "id",
      lawyerId: "lawyerId",
      clientId: "clientId",
      status: "status",
      totalCents: "totalCents",
      kind: "kind",
    },
    user: { id: "id", email: "email", name: "name" },
    invoiceLines: { invoiceId: "invoiceId" },
    payments: { id: "id", provider: "provider", providerPaymentId: "providerPaymentId", invoiceId: "invoiceId" },
    transactions: { invoiceId: "invoiceId" },
    discountCodes: { id: "id", lawyerId: "lawyerId" },
    lawyerSubscriptions: { lawyerId: "lawyerId" },
  },
}));

vi.mock("../middleware/session", () => ({
  requireSession: stubRequireSession,
  requireRole: stubRequireRole,
}));

vi.mock("../lib/billing", () => ({
  computeLineTotalCents: vi.fn(() => 0),
  computeDiscountCents: vi.fn(() => 0),
  newInvoiceNumber: vi.fn(() => "INV-XXX"),
}));

vi.mock("../lib/subscription", () => ({
  RENEWAL_DAYS: 30,
  addDays: (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000),
}));

vi.mock("../lib/format", () => ({
  formatPhp: (cents: number) => `₱${(cents / 100).toFixed(2)}`,
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
}));

vi.mock("../lib/paymongo", () => ({
  createCheckoutSession: vi.fn(),
  PAYMONGO_MIN_AMOUNT_CENTS: 2000,
  PaymongoApiError: class PaymongoApiError extends Error {},
  PaymongoUnreachableError: class PaymongoUnreachableError extends Error {},
}));

// ---------------------------------------------------------------------------
// Import router AFTER all mocks are registered.
// ---------------------------------------------------------------------------

import { billing } from "./billing";

function buildApp() {
  return new Hono().route("/billing", billing);
}

// ---------------------------------------------------------------------------
// Helpers — shared fake row shapes.
// ---------------------------------------------------------------------------

const FAKE_INVOICE = {
  id: FAKE_INVOICE_ID,
  number: FAKE_INVOICE_NUMBER,
  kind: "case" as const,
  status: "draft" as const,
  lawyerId: FAKE_LAWYER_ID,
  clientId: FAKE_CLIENT_ID,
  caseId: "case_1",
  totalCents: 50000,
  paidCents: 0,
  subtotalCents: 50000,
  discountCents: 0,
  currency: "PHP",
  appliedDiscountCodeId: null,
  notesMd: null,
  dueAt: null,
  sentAt: null,
  paidAt: null,
  voidedAt: null,
  voidReason: null,
  engagementId: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const FAKE_CLIENT_USER = {
  id: FAKE_CLIENT_ID,
  name: "Maria Santos",
  email: "client@example.com",
  role: "client" as const,
  status: "active" as const,
  emailVerified: true,
  image: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const FAKE_LAWYER_USER = {
  id: FAKE_LAWYER_ID,
  name: "Atty. Juan Dela Cruz",
  email: "lawyer@example.com",
  role: "lawyer" as const,
  status: "active" as const,
  emailVerified: true,
  image: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /billing/invoices/:id/send — invoice_sent email", () => {
  beforeEach(() => {
    mockDispatchEmail.mockClear().mockResolvedValue(undefined);
    mockUpdateWhere.mockClear().mockResolvedValue([]);
    mockUpdateSet.mockClear().mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockClear().mockReturnValue({ set: mockUpdateSet });
    // Reset findFirst: 1st call = invoice, 2nd = clientUser
    // (lawyerName comes from the session user directly — no extra DB lookup)
    mockFindFirst
      .mockResolvedValueOnce(FAKE_INVOICE)
      .mockResolvedValueOnce(FAKE_CLIENT_USER);
    mockDb.mockReturnValue({
      query: {
        invoices: { findFirst: mockFindFirst },
        user: { findFirst: mockFindFirst },
      },
      update: mockUpdate,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls dispatchEmail with kind:invoice_sent and the correct dedupeKey", async () => {
    const app = buildApp();
    const res = await app.request(`/billing/invoices/${FAKE_INVOICE_ID}/send`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    expect(mockDispatchEmail).toHaveBeenCalledTimes(1);
    const [msg] = mockDispatchEmail.mock.calls[0] as [Record<string, unknown>];
    expect(msg.kind).toBe("invoice_sent");
    expect(msg.dedupeKey).toBe(`invoice_sent:${FAKE_INVOICE_ID}`);
    expect(msg.to).toBe(FAKE_CLIENT_USER.email);
    expect((msg.data as Record<string, unknown>).clientName).toBe(FAKE_CLIENT_USER.name);
    expect((msg.data as Record<string, unknown>).lawyerName).toBe(FAKE_LAWYER_USER.name);
    expect((msg.data as Record<string, unknown>).invoiceNumber).toBe(FAKE_INVOICE_NUMBER);
    expect((msg.data as Record<string, unknown>).invoiceUrl).toContain(`/invoices/${FAKE_INVOICE_ID}`);
  });

  it("does NOT call dispatchEmail when invoice has no clientId (subscription guard)", async () => {
    const subInvoice = { ...FAKE_INVOICE, kind: "subscription" as const, clientId: null };
    mockFindFirst.mockReset().mockResolvedValueOnce(subInvoice);
    mockDb.mockReturnValue({
      query: {
        invoices: { findFirst: mockFindFirst },
        user: { findFirst: mockFindFirst },
      },
      update: mockUpdate,
    });

    const app = buildApp();
    const res = await app.request(`/billing/invoices/${FAKE_INVOICE_ID}/send`, {
      method: "POST",
    });

    // totalCents > 0 guard passes; status guard: note subInvoice.status = draft passes
    expect(res.status).toBe(200);
    expect(mockDispatchEmail).not.toHaveBeenCalled();
  });
});

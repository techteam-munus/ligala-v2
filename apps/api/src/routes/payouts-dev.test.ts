/**
 * Tests for the dev-only POST /simulate-transfer endpoint exported as
 * `payoutsDev` from routes/payouts.ts.
 *
 * Mocking strategy:
 *  - ../lib/transfer-webhook: applyTransferWebhook is a vi.fn() (the only
 *    function payoutsDev actually calls)
 *  - @ligala/db, ../middleware/session, ../lib/env, ../lib/paymongo,
 *    @ligala/shared/schemas, ../lib/payouts: minimal stubs so the payouts
 *    module loads without hitting real infra.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Hoisted state
// ---------------------------------------------------------------------------

const { mockApplyTransferWebhook } = vi.hoisted(() => {
  const mockApplyTransferWebhook = vi.fn().mockResolvedValue({
    idempotent: false,
    payoutId: "po_1",
    status: "succeeded",
  });
  return { mockApplyTransferWebhook };
});

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that transitively touches them
// ---------------------------------------------------------------------------

vi.mock("../lib/transfer-webhook", () => ({
  applyTransferWebhook: mockApplyTransferWebhook,
}));

vi.mock("@ligala/db", () => ({
  db: () => ({
    query: {
      kycSubmissions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      lawyerPayoutMethods: { findFirst: vi.fn().mockResolvedValue(undefined) },
      payouts: { findFirst: vi.fn().mockResolvedValue(undefined) },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    transaction: vi.fn().mockResolvedValue(undefined),
  }),
  schema: {
    kycSubmissions: {},
    lawyerPayoutMethods: {},
    payouts: {},
    balanceEntries: {},
  },
}));

vi.mock("../middleware/session", () => ({
  requireRole: () => async (c: unknown, next: () => Promise<void>) => next(),
  requireSession: () => async (c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../lib/env", () => ({
  env: () => ({
    PAYMONGO_WALLET_ACCOUNT_NUMBER: undefined,
    PAYMONGO_SECRET_KEY: undefined,
    PAYOUT_MIN_CENTS: 5000,
    BETTER_AUTH_URL: "https://app.test",
  }),
}));

vi.mock("../lib/paymongo", () => ({
  createBatchTransfer: vi.fn(),
  PaymongoApiError: class PaymongoApiError extends Error {},
  PaymongoUnreachableError: class PaymongoUnreachableError extends Error {},
}));

vi.mock("../lib/payouts", () => ({
  PAYOUT_FEE_CENTS: 1000,
  checkWithdrawable: vi.fn().mockReturnValue({ ok: true }),
  computeBalance: vi.fn().mockReturnValue({ availableCents: 100000, pendingCents: 0 }),
}));

vi.mock("@ligala/shared/schemas", () => ({
  payoutMethodInput: { parse: vi.fn() },
  withdrawalInput: { parse: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are wired
// ---------------------------------------------------------------------------

import { payoutsDev } from "./payouts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp() {
  return new Hono().route("/", payoutsDev);
}

function post(app: Hono, search: string) {
  return app.request(`/simulate-transfer${search}`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("payoutsDev POST /simulate-transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyTransferWebhook.mockResolvedValue({
      idempotent: false,
      payoutId: "po_1",
      status: "succeeded",
    });
  });

  it("calls applyTransferWebhook with provider=dev_simulate and status=succeeded by default, returns 200", async () => {
    const app = buildApp();
    const res = await post(app, "?payoutId=po_1");
    expect(res.status).toBe(200);
    expect(mockApplyTransferWebhook).toHaveBeenCalledOnce();
    expect(mockApplyTransferWebhook).toHaveBeenCalledWith({
      provider: "dev_simulate",
      providerTransferId: "po_1",
      status: "succeeded",
    });
    const body = (await res.json()) as { idempotent: boolean; payoutId: string; status: string };
    expect(body).toEqual({ idempotent: false, payoutId: "po_1", status: "succeeded" });
  });

  it("passes status=failed when ?status=failed is given", async () => {
    mockApplyTransferWebhook.mockResolvedValue({
      idempotent: false,
      payoutId: "po_1",
      status: "failed",
    });
    const app = buildApp();
    const res = await post(app, "?payoutId=po_1&status=failed");
    expect(res.status).toBe(200);
    expect(mockApplyTransferWebhook).toHaveBeenCalledWith({
      provider: "dev_simulate",
      providerTransferId: "po_1",
      status: "failed",
    });
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("failed");
  });

  it("returns 400 when payoutId is missing", async () => {
    const app = buildApp();
    const res = await post(app, "");
    expect(res.status).toBe(400);
    expect(mockApplyTransferWebhook).not.toHaveBeenCalled();
    // HTTPException without an error handler sends the message as plain text
    const text = await res.text();
    expect(text).toBe("missing_params");
  });
});

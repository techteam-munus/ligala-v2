import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be before any imports that resolve @ligala/db
// ---------------------------------------------------------------------------
const {
  mockTxUpdateWhere,
  mockTxUpdateSet,
  mockTxUpdate,
  mockTxInsertValues,
  mockTxInsert,
  mockTx,
  mockTransaction,
  mockFindFirst,
  mockDb,
} = vi.hoisted(() => {
  const mockTxUpdateWhere = vi.fn().mockResolvedValue([]);
  const mockTxUpdateSet = vi.fn(() => ({ where: mockTxUpdateWhere }));
  const mockTxUpdate = vi.fn(() => ({ set: mockTxUpdateSet }));
  const mockTxInsertValues = vi.fn().mockResolvedValue([]);
  const mockTxInsert = vi.fn(() => ({ values: mockTxInsertValues }));
  const mockTx = { update: mockTxUpdate, insert: mockTxInsert };
  const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<void>) => {
    await cb(mockTx);
  });
  const mockFindFirst = vi.fn();
  const mockDb = {
    query: { payouts: { findFirst: mockFindFirst } },
    transaction: mockTransaction,
  };
  return {
    mockTxUpdateWhere,
    mockTxUpdateSet,
    mockTxUpdate,
    mockTxInsertValues,
    mockTxInsert,
    mockTx,
    mockTransaction,
    mockFindFirst,
    mockDb,
  };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: {
    payouts: { id: "id", providerTransferId: "provider_transfer_id", provider: "provider" },
    balanceEntries: {},
  },
}));

// eq/and are used in the where clause; mock them to pass through so findFirst resolves
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  and: vi.fn((...conds: unknown[]) => ({ and: conds })),
}));

import { mapTransferStatus, applyTransferWebhook } from "./transfer-webhook";

// ---------------------------------------------------------------------------
// Existing mapper tests (keep as-is)
// ---------------------------------------------------------------------------
describe("mapTransferStatus", () => {
  it("maps provider statuses to payout statuses", () => {
    expect(mapTransferStatus("succeeded")).toBe("succeeded");
    expect(mapTransferStatus("failed")).toBe("failed");
    expect(mapTransferStatus("returned")).toBe("returned");
  });
  it("treats unknown as null (ignore)", () => {
    expect(mapTransferStatus("queued")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyTransferWebhook tests
// ---------------------------------------------------------------------------
describe("applyTransferWebhook", () => {
  const processingPayout = {
    id: "payout_1",
    lawyerId: "lawyer_1",
    status: "processing",
    netCents: 59000,
    feeCents: 1000,
    currency: "PHP",
    providerTransferId: "tr_1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: insert resolves ok
    mockTxInsertValues.mockResolvedValue([]);
    mockTxUpdateWhere.mockResolvedValue([]);
  });

  it("failed → re-credits net + fee (two adjustment/credit entries)", async () => {
    mockFindFirst.mockResolvedValue(processingPayout);

    const result = await applyTransferWebhook({
      provider: "paymongo",
      providerTransferId: "tr_1",
      status: "failed",
      failureReason: "x",
    });

    expect(result).toEqual({
      idempotent: false,
      payoutId: "payout_1",
      status: "failed",
    });

    // transaction was entered
    expect(mockTransaction).toHaveBeenCalledOnce();

    // payout update called with failed status
    expect(mockTxUpdate).toHaveBeenCalledOnce();
    const setCall = (mockTxUpdateSet.mock.calls as unknown as [unknown[]])[0]?.[0] as Record<string, unknown>;
    expect(setCall).toMatchObject({ status: "failed", failureReason: "x" });
    expect(setCall.completedAt).toBeNull();

    // insert called once with two entries
    expect(mockTxInsert).toHaveBeenCalledOnce();
    const insertedEntries = (mockTxInsertValues.mock.calls as unknown as [unknown[]])[0]?.[0] as Array<Record<string, unknown>>;
    expect(insertedEntries).toHaveLength(2);

    const netEntry = insertedEntries.find((e) => e["amountCents"] === 59000);
    expect(netEntry).toMatchObject({ kind: "adjustment", direction: "credit", amountCents: 59000 });

    const feeEntry = insertedEntries.find((e) => e["amountCents"] === 1000);
    expect(feeEntry).toMatchObject({ kind: "adjustment", direction: "credit", amountCents: 1000 });
  });

  it("succeeded → NO re-credit; completedAt is a Date", async () => {
    mockFindFirst.mockResolvedValue(processingPayout);

    const result = await applyTransferWebhook({
      provider: "paymongo",
      providerTransferId: "tr_1",
      status: "succeeded",
    });

    expect(result).toEqual({
      idempotent: false,
      payoutId: "payout_1",
      status: "succeeded",
    });

    expect(mockTransaction).toHaveBeenCalledOnce();

    // update was called; completedAt must be a Date
    expect(mockTxUpdate).toHaveBeenCalledOnce();
    const setCall = (mockTxUpdateSet.mock.calls as unknown as [unknown[]])[0]?.[0] as Record<string, unknown>;
    expect(setCall).toMatchObject({ status: "succeeded" });
    expect(setCall.completedAt).toBeInstanceOf(Date);

    // NO balance_entries insert
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("idempotent replay → returns idempotent:true; no transaction, no writes", async () => {
    mockFindFirst.mockResolvedValue({ ...processingPayout, status: "failed" });

    const result = await applyTransferWebhook({
      provider: "paymongo",
      providerTransferId: "tr_1",
      status: "failed",
    });

    expect(result).toMatchObject({ idempotent: true, payoutId: "payout_1", status: "failed" });

    // No writes
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it("payout not found → throws HTTPException with status 404", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const call = applyTransferWebhook({
      provider: "paymongo",
      providerTransferId: "tr_missing",
      status: "failed",
    });

    // Must reject; inspect the error for .status === 404
    await expect(call).rejects.toThrow();

    try {
      await applyTransferWebhook({
        provider: "paymongo",
        providerTransferId: "tr_missing",
        status: "failed",
      });
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(404);
    }

    // No transaction entered
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("dev_simulate provider cannot find a paymongo payout by id → 404, no writes", async () => {
    // The payout exists in the DB with provider "paymongo", but the lookup is
    // called with provider "dev_simulate". The and(id, provider=dev_simulate)
    // filter should not match it — findFirst returns undefined (no match).
    mockFindFirst.mockResolvedValue(undefined);

    let caughtErr: unknown;
    try {
      await applyTransferWebhook({
        provider: "dev_simulate",
        providerTransferId: "payout_1", // same id as a real paymongo payout
        status: "succeeded",
      });
    } catch (err) {
      caughtErr = err;
    }

    // Must throw with status 404
    expect(caughtErr).toBeDefined();
    expect((caughtErr as { status: number }).status).toBe(404);

    // No transaction, no update, no insert
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });
});

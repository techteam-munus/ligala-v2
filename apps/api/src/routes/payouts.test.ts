/**
 * Tests for apps/api/src/routes/payouts.ts
 *
 * Mocking strategy:
 *  - @ligala/db: db() returns a mock connection object; schema is a plain stub
 *  - ../middleware/session: requireRole injected as a pass-through that sets user
 *  - ../lib/env: returns test env (PAYMONGO_WALLET_ACCOUNT_NUMBER undefined → dev_simulate)
 *  - ../lib/paymongo: createBatchTransfer is a vi.fn(); error classes are real constructors
 *  - ../lib/sentry: no-op (required by ../middleware/error)
 *
 * The test app wires up the real errorHandler so HTTPException responses are
 * serialised as { error: "<message>", status: N } JSON objects.
 *
 * Transaction path: conn.transaction(cb) invokes cb asynchronously with a tx stub.
 * The tx stub wires up: execute (no-op), select().from().where() → ledger rows,
 * and insert().values().returning() → created payout row.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable state (must be declared before vi.mock factories run)
// ---------------------------------------------------------------------------

const {
  mockEnvState,
  mockKycFindFirst,
  mockMethodFindFirst,
  mockInsertValuesReturning,
  mockInsert,
  mockUpdate,
  mockDb,
  mockCreateBatchTransfer,
  lawyerUser,
  methodRow,
  payoutCreatedRow,
} = vi.hoisted(() => {
  const lawyerUser = {
    id: "law_1",
    role: "lawyer" as const,
    name: "Atty Test",
    email: "atty@test.com",
    status: "active" as const,
  };

  const methodRow = {
    id: "meth_1",
    lawyerId: "law_1",
    type: "gcash" as const,
    accountNumber: "09171234567",
    accountHolderName: "Atty Test",
    bankBic: null,
    isDefault: false,
    verified: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const payoutCreatedRow = {
    id: "pout_1",
    lawyerId: "law_1",
    payoutMethodId: "meth_1",
    amountCents: 60000,
    feeCents: 1000,
    netCents: 59000,
    currency: "PHP",
    provider: "dev_simulate" as const,
    providerTransferId: null,
    status: "pending" as const,
    failureReason: null,
    destinationSnapshot: {},
    requestedAt: new Date("2024-01-01"),
    completedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockInsertValuesReturning = vi.fn().mockResolvedValue([payoutCreatedRow]);
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  }));
  const mockKycFindFirst = vi.fn().mockResolvedValue({ status: "approved" });
  const mockMethodFindFirst = vi.fn().mockResolvedValue(methodRow);
  const mockDb = vi.fn();
  const mockCreateBatchTransfer = vi.fn();

  const mockEnvState = {
    NODE_ENV: undefined as string | undefined,
    PAYMONGO_WALLET_ACCOUNT_NUMBER: undefined as string | undefined,
    PAYMONGO_WALLET_ACCOUNT_NAME: "Ligala",
    PAYMONGO_WALLET_BIC: undefined as string | undefined,
    PAYMONGO_SECRET_KEY: undefined as string | undefined,
    BETTER_AUTH_URL: "https://app.test",
    PAYOUT_MIN_CENTS: 50000,
  };

  return {
    mockEnvState,
    mockKycFindFirst,
    mockMethodFindFirst,
    mockInsertValuesReturning,
    mockInsert,
    mockUpdate,
    mockDb,
    mockCreateBatchTransfer,
    lawyerUser,
    methodRow,
    payoutCreatedRow,
  };
});

// ---------------------------------------------------------------------------
// vi.mock declarations
// ---------------------------------------------------------------------------

vi.mock("@ligala/db", () => ({
  db: mockDb,
  schema: {
    balanceEntries: { lawyerId: "lawyer_id", createdAt: "created_at" },
    lawyerPayoutMethods: { lawyerId: "lawyer_id", id: "id", createdAt: "created_at" },
    payouts: { lawyerId: "lawyer_id", id: "id", createdAt: "created_at" },
    kycSubmissions: { lawyerId: "lawyer_id", createdAt: "created_at" },
  },
}));

vi.mock("../middleware/session", () => ({
  requireRole: (_role: string) =>
    async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set("user", lawyerUser);
      await next();
    },
}));

vi.mock("../lib/env", () => ({ env: () => mockEnvState }));

vi.mock("../lib/paymongo", () => ({
  createBatchTransfer: mockCreateBatchTransfer,
  PaymongoApiError: class PaymongoApiError extends Error {
    status: number;
    bodyText: string;
    constructor(status: number, bodyText: string) {
      super(`paymongo_api_error_${status}`);
      this.name = "PaymongoApiError";
      this.status = status;
      this.bodyText = bodyText;
    }
  },
  PaymongoUnreachableError: class PaymongoUnreachableError extends Error {
    constructor(cause: unknown) {
      super("paymongo_unreachable");
      this.name = "PaymongoUnreachableError";
      this.cause = cause;
    }
  },
}));

vi.mock("../lib/sentry", () => ({
  captureException: vi.fn(),
  initSentry: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the route and error handler AFTER mocks are set up
// ---------------------------------------------------------------------------

import { payouts } from "./payouts";
import { errorHandler } from "../middleware/error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a test app that includes the real error handler so HTTPException → JSON. */
function buildApp() {
  const app = new Hono();
  app.route("/lawyer/payouts", payouts);
  app.onError(errorHandler);
  return app;
}

function req(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "content-type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

/** Build a per-test conn mock with configurable tx ledger rows. */
function buildConn(txLedgerRows: unknown[]) {
  let insertCallIndex = 0;
  const txInsert = vi.fn(() => {
    insertCallIndex++;
    if (insertCallIndex === 1) {
      // First insert in tx = payouts table → needs .returning()
      return {
        values: vi.fn(() => ({
          returning: mockInsertValuesReturning,
        })),
      };
    }
    // Subsequent inserts = balance_entries
    return {
      values: vi.fn().mockResolvedValue([]),
    };
  });

  const txStub = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(txLedgerRows),
      })),
    })),
    insert: txInsert,
  };

  const txn = vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => cb(txStub));

  return {
    query: {
      kycSubmissions: { findFirst: mockKycFindFirst },
      lawyerPayoutMethods: { findFirst: mockMethodFindFirst },
    },
    transaction: txn,
    update: mockUpdate,
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  };
}

/**
 * Like buildConn but wires the OUTER conn's insert to the hoisted mockInsert
 * so that failure-path re-credit calls can be inspected.
 */
function buildConnForFailurePath(txLedgerRows: unknown[]) {
  const base = buildConn(txLedgerRows);
  // Track values() calls so tests can assert the re-credit entries
  const mockOuterInsertValues = vi.fn().mockResolvedValue([]);
  mockInsert.mockReturnValue({ values: mockOuterInsertValues });
  base.insert = mockInsert as typeof base.insert;
  return { conn: base, mockOuterInsertValues };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /lawyer/payouts/balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.mockReturnValue(
      buildConn([
        { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
      ]),
    );
  });

  it("returns availableCents, pendingCents, currency PHP", async () => {
    // Override the outer select used by loadLedgerLines
    const conn = buildConn([]);
    conn.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
        ]),
      })),
    }));
    mockDb.mockReturnValue(conn);
    const app = buildApp();
    const res = await app.request(req("/lawyer/payouts/balance"));
    expect(res.status).toBe(200);
    const body = await res.json() as { availableCents: number; pendingCents: number; currency: string };
    expect(body.currency).toBe("PHP");
    expect(body.availableCents).toBe(100000);
    expect(body.pendingCents).toBe(0);
  });
});

describe("GET /lawyer/payouts/methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const conn = buildConn([]);
    conn.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([methodRow]),
        })),
      })),
    }));
    mockDb.mockReturnValue(conn);
  });

  it("returns items array", async () => {
    const app = buildApp();
    const res = await app.request(req("/lawyer/payouts/methods"));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /lawyer/payouts/methods — KYC gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKycFindFirst.mockResolvedValue({ status: "pending" });
    mockDb.mockReturnValue(buildConn([]));
  });

  it("returns 403 when KYC is not approved", async () => {
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts/methods", {
        method: "POST",
        body: {
          type: "gcash",
          accountNumber: "09171234567",
          accountHolderName: "Atty Test",
        },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("kyc_not_approved");
  });
});

describe("POST /lawyer/payouts — withdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnvState.NODE_ENV = undefined;
    mockEnvState.PAYMONGO_WALLET_ACCOUNT_NUMBER = undefined;
    mockKycFindFirst.mockResolvedValue({ status: "approved" });
    mockMethodFindFirst.mockResolvedValue(methodRow);
    mockInsertValuesReturning.mockResolvedValue([payoutCreatedRow]);
  });

  it("happy path: 201 with provider dev_simulate when PAYMONGO_WALLET_ACCOUNT_NUMBER is unset", async () => {
    mockDb.mockReturnValue(
      buildConn([
        { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
      ]),
    );
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { payout: { provider: string } };
    expect(body.payout.provider).toBe("dev_simulate");
  });

  it("returns 501 payouts_not_configured in production when no disbursement wallet is set (does not debit the ledger)", async () => {
    // In production the dev_simulate fallthrough is a trap: it would debit the
    // ledger and create a payout that can never settle (the simulate endpoint
    // 404s in prod). The guard must refuse before any ledger write.
    mockEnvState.NODE_ENV = "production";
    mockEnvState.PAYMONGO_WALLET_ACCOUNT_NUMBER = undefined;
    mockDb.mockReturnValue(
      buildConn([
        { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
      ]),
    );
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );
    expect(res.status).toBe(501);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("payouts_not_configured");
    // Fail-fast: no payout row created, ledger untouched.
    expect(mockInsertValuesReturning).not.toHaveBeenCalled();
  });

  it("returns 404 method_not_found when method belongs to a different lawyer", async () => {
    mockMethodFindFirst.mockResolvedValue({ ...methodRow, lawyerId: "other_lawyer" });
    mockDb.mockReturnValue(buildConn([]));
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("method_not_found");
  });

  it("returns 404 method_not_found when method does not exist", async () => {
    mockMethodFindFirst.mockResolvedValue(undefined);
    mockDb.mockReturnValue(buildConn([]));
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "nonexistent", amountCents: 60000 },
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("method_not_found");
  });

  it("returns 403 kyc_not_approved when KYC is not approved", async () => {
    mockKycFindFirst.mockResolvedValue({ status: "rejected" });
    mockDb.mockReturnValue(buildConn([]));
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("kyc_not_approved");
  });

  it("returns 409 insufficient_balance when available balance is below request", async () => {
    // Available: 10 000 cents, request: 60 000 (passes min check but insufficient)
    mockDb.mockReturnValue(
      buildConn([
        { direction: "credit", amountCents: 10000, clearsAt: new Date("2020-01-01") },
      ]),
    );
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("insufficient_balance");
  });

  it("returns 409 amount_below_minimum when request is below PAYOUT_MIN_CENTS", async () => {
    // Available: 200 000 cents, request: 10 000 (below min of 50 000)
    mockDb.mockReturnValue(
      buildConn([
        { direction: "credit", amountCents: 200000, clearsAt: new Date("2020-01-01") },
      ]),
    );
    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 10000 },
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("amount_below_minimum");
  });

  it("PaymongoApiError → 502 paymongo_request_failed + balance re-credited", async () => {
    // Set up paymongo path: PAYMONGO_WALLET_ACCOUNT_NUMBER is truthy
    mockEnvState.PAYMONGO_WALLET_ACCOUNT_NUMBER = "ACCT123";
    mockEnvState.PAYMONGO_SECRET_KEY = "sk_test_xxx";
    mockEnvState.PAYMONGO_WALLET_BIC = undefined;

    // The tx insert must return a payout row with provider "paymongo"
    const paymongoPayoutRow = { ...payoutCreatedRow, provider: "paymongo" as const };
    mockInsertValuesReturning.mockResolvedValueOnce([paymongoPayoutRow]);

    // Sufficient available balance (100 000 cents, request 60 000)
    const { conn, mockOuterInsertValues } = buildConnForFailurePath([
      { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
    ]);
    mockDb.mockReturnValue(conn);

    // createBatchTransfer rejects with PaymongoApiError
    const { PaymongoApiError } = await import("../lib/paymongo");
    mockCreateBatchTransfer.mockRejectedValueOnce(new PaymongoApiError(422, "card_declined"));

    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );

    // 1. HTTP 502
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    // 2. Error code
    expect(body.error).toBe("paymongo_request_failed");

    // 3. Re-credit: outer conn.insert called with two adjustment credit entries
    expect(mockOuterInsertValues).toHaveBeenCalledOnce();
    const [entries] = mockOuterInsertValues.mock.calls[0] as [Array<{ kind: string; direction: string; amountCents: number }>];
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === "adjustment" && e.direction === "credit")).toBe(true);
    // One entry for net, one for fee
    const netEntry = entries.find((e) => e.amountCents === paymongoPayoutRow.netCents);
    const feeEntry = entries.find((e) => e.amountCents === paymongoPayoutRow.feeCents);
    expect(netEntry).toBeDefined();
    expect(feeEntry).toBeDefined();
  });

  it("PaymongoUnreachableError → 502 paymongo_unreachable + balance re-credited", async () => {
    // Set up paymongo path
    mockEnvState.PAYMONGO_WALLET_ACCOUNT_NUMBER = "ACCT123";
    mockEnvState.PAYMONGO_SECRET_KEY = "sk_test_xxx";
    mockEnvState.PAYMONGO_WALLET_BIC = undefined;

    // The tx insert must return a payout row with provider "paymongo"
    const paymongoPayoutRow = { ...payoutCreatedRow, provider: "paymongo" as const };
    mockInsertValuesReturning.mockResolvedValueOnce([paymongoPayoutRow]);

    // Sufficient available balance
    const { conn, mockOuterInsertValues } = buildConnForFailurePath([
      { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
    ]);
    mockDb.mockReturnValue(conn);

    // createBatchTransfer rejects with PaymongoUnreachableError
    const { PaymongoUnreachableError } = await import("../lib/paymongo");
    mockCreateBatchTransfer.mockRejectedValueOnce(
      new PaymongoUnreachableError(new Error("connect ECONNREFUSED")),
    );

    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );

    // 1. HTTP 502
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    // 2. Error code
    expect(body.error).toBe("paymongo_unreachable");

    // 3. Re-credit: outer conn.insert called with two adjustment credit entries
    expect(mockOuterInsertValues).toHaveBeenCalledOnce();
    const [entries] = mockOuterInsertValues.mock.calls[0] as [Array<{ kind: string; direction: string; amountCents: number }>];
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === "adjustment" && e.direction === "credit")).toBe(true);
    // One entry for net, one for fee
    const netEntry = entries.find((e) => e.amountCents === paymongoPayoutRow.netCents);
    const feeEntry = entries.find((e) => e.amountCents === paymongoPayoutRow.feeCents);
    expect(netEntry).toBeDefined();
    expect(feeEntry).toBeDefined();
  });

  it("paymongo success path: 201, status processing, providerTransferId set", async () => {
    // Set up paymongo path: wallet account + secret key present
    mockEnvState.PAYMONGO_WALLET_ACCOUNT_NUMBER = "ACCT123";
    mockEnvState.PAYMONGO_SECRET_KEY = "sk_test_xxx";
    mockEnvState.PAYMONGO_WALLET_BIC = undefined;

    // The tx insert must return a payout row with provider "paymongo"
    const paymongoPayoutRow = { ...payoutCreatedRow, provider: "paymongo" as const };
    mockInsertValuesReturning.mockResolvedValueOnce([paymongoPayoutRow]);

    // Sufficient available balance
    const { conn } = buildConnForFailurePath([
      { direction: "credit", amountCents: 100000, clearsAt: new Date("2020-01-01") },
    ]);
    mockDb.mockReturnValue(conn);

    // createBatchTransfer resolves with a transferId
    mockCreateBatchTransfer.mockResolvedValueOnce({ transferId: "tr_success_1" });

    const app = buildApp();
    const res = await app.request(
      req("/lawyer/payouts", {
        method: "POST",
        body: { payoutMethodId: "meth_1", amountCents: 60000 },
      }),
    );

    // 1. HTTP 201
    expect(res.status).toBe(201);
    const body = await res.json() as { payout: { status: string; providerTransferId: string } };
    // 2. Status is processing
    expect(body.payout.status).toBe("processing");
    // 3. providerTransferId from the transfer
    expect(body.payout.providerTransferId).toBe("tr_success_1");
  });
});

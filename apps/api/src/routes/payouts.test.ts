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
  mockTransaction,
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
  const mockTransaction = vi.fn();
  const mockDb = vi.fn();
  const mockCreateBatchTransfer = vi.fn();

  const mockEnvState = {
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
    mockTransaction,
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
});

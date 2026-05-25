/**
 * Tests for the env-gated POST /accounts/_dev/verify-email route.
 *
 * Harness: minimal Hono app with clients router mounted at /accounts.
 * All external dependencies (@ligala/db, ../lib/env, ../middleware/session,
 * ../lib/slug, ../lib/subscription) are mocked via vi.hoisted + vi.mock so
 * that vi.mock factories only reference values created by vi.hoisted (which
 * runs before the module graph is resolved, avoiding TDZ errors).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// --------------------------------------------------------------------------
// vi.hoisted: everything referenced inside vi.mock factories must live here.
// --------------------------------------------------------------------------

const {
  mockEnvState,
  mockWhere,
  mockSet,
  mockUpdate,
  mockDb,
  mockEq,
  stubRequireSession,
  FAKE_USER_ID,
} = vi.hoisted(() => {
  const FAKE_USER_ID = "usr_test123";

  const stubRequireSession = vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: FAKE_USER_ID,
      name: "Test User",
      email: "test@example.com",
      emailVerified: false,
      image: null,
      role: "client",
      status: "active",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });
    await next();
  });

  const mockWhere = vi.fn().mockResolvedValue([]);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockDb = vi.fn().mockReturnValue({ update: mockUpdate });
  const mockEq = vi.fn((col: unknown, val: unknown) => ({ col, val }));
  const mockEnvState = { EMAIL_DEV_VERIFY_ENABLED: "false" as "true" | "false" };

  return {
    mockEnvState,
    mockWhere,
    mockSet,
    mockUpdate,
    mockDb,
    mockEq,
    stubRequireSession,
    FAKE_USER_ID,
  };
});

// --------------------------------------------------------------------------
// Mocks — factories only reference hoisted values, no TDZ issues.
// --------------------------------------------------------------------------

vi.mock("../lib/env", () => ({
  env: () => mockEnvState,
}));

vi.mock("@ligala/db", () => ({
  db: mockDb,
  schema: {
    user: { id: "id" },
    clientProfiles: { userId: "userId" },
    ibpLawyers: { id: "id", userId: "userId" },
    lawyerProfiles: { userId: "userId", slug: "slug" },
    lawyerSubscriptions: { lawyerId: "lawyerId" },
  },
  eq: mockEq,
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((col: unknown) => ({ isNull: col })),
}));

vi.mock("../middleware/session", () => ({
  requireSession: stubRequireSession,
  requireRole: () => stubRequireSession,
}));

vi.mock("../lib/slug", () => ({
  slugify: (s: string) => s.toLowerCase().replace(/\s+/g, "-"),
  withRandomSuffix: (s: string) => `${s}-xyz`,
}));

vi.mock("../lib/subscription", () => ({
  SUBSCRIPTION_PRICE_CENTS: 99900,
  TRIAL_DAYS: 30,
  addDays: (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000),
}));

// --------------------------------------------------------------------------
// Import router after all mocks are registered.
// --------------------------------------------------------------------------

import { clients } from "./clients";

function buildApp() {
  return new Hono().route("/accounts", clients);
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("POST /accounts/_dev/verify-email", () => {
  beforeEach(() => {
    mockWhere.mockClear().mockResolvedValue([]);
    mockSet.mockClear().mockReturnValue({ where: mockWhere });
    mockUpdate.mockClear().mockReturnValue({ set: mockSet });
    mockDb.mockClear().mockReturnValue({ update: mockUpdate });
    mockEq.mockClear().mockImplementation((col: unknown, val: unknown) => ({ col, val }));
    stubRequireSession.mockClear();
    // Default to disabled
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "false";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when EMAIL_DEV_VERIFY_ENABLED is not 'true' (default false)", async () => {
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "false";
    const app = buildApp();
    const res = await app.request("/accounts/_dev/verify-email", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { message: string };
    expect(body.message).toBe("not_found");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 200 { ok: true } and calls db update with emailVerified=true when EMAIL_DEV_VERIFY_ENABLED=true", async () => {
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "true";
    const app = buildApp();
    const res = await app.request("/accounts/_dev/verify-email", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    // Verify DB update was called
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
    const setArgs = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs).toMatchObject({ emailVerified: true });
    expect(setArgs.updatedAt).toBeInstanceOf(Date);

    // Verify where clause was called (eq from drizzle-orm is real, not mocked)
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});

/**
 * Tests for the env-gated, SESSION-LESS POST /accounts/_dev/verify-email route
 * (see routes/dev-accounts.ts). It takes the email in the body — not the
 * session — because under hard email verification a freshly signed-up user has
 * no session yet (sign-up returns token:null, sign-in is blocked until
 * verified), so a session-bound route would deadlock.
 *
 * Only @ligala/db and ../lib/env are mocked; `eq` (drizzle-orm) and `z` (zod)
 * are the real implementations. vi.hoisted holds everything the vi.mock
 * factories reference so they exist before the module graph resolves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const { mockEnvState, mockReturning, mockWhere, mockSet, mockUpdate, mockDb } =
  vi.hoisted(() => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: "usr_1" }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockDb = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockEnvState = {
      EMAIL_DEV_VERIFY_ENABLED: "false" as "true" | "false",
    };
    return { mockEnvState, mockReturning, mockWhere, mockSet, mockUpdate, mockDb };
  });

vi.mock("../lib/env", () => ({ env: () => mockEnvState }));

vi.mock("@ligala/db", () => ({
  db: mockDb,
  schema: { user: { id: "id", email: "email" } },
}));

import { devAccounts } from "./dev-accounts";

function buildApp() {
  return new Hono().route("/accounts/_dev", devAccounts);
}

function post(app: Hono, body?: unknown) {
  return app.request("/accounts/_dev/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /accounts/_dev/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: "usr_1" }]);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockDb.mockReturnValue({ update: mockUpdate });
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "false";
  });

  it("returns 404 when EMAIL_DEV_VERIFY_ENABLED is not 'true' (and skips the DB)", async () => {
    const res = await post(buildApp(), { email: "a@b.com" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { message: string }).message).toBe("not_found");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 on a body missing a valid email", async () => {
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "true";
    const res = await post(buildApp(), { email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("verifies the user by email and returns 200 { ok: true }", async () => {
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "true";
    const res = await post(buildApp(), { email: "client@example.com" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const setArgs = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs).toMatchObject({ emailVerified: true });
    expect(setArgs.updatedAt).toBeInstanceOf(Date);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it("returns 404 user_not_found when no row matches the email", async () => {
    mockEnvState.EMAIL_DEV_VERIFY_ENABLED = "true";
    mockReturning.mockResolvedValue([]);
    const res = await post(buildApp(), { email: "ghost@example.com" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { message: string }).message).toBe(
      "user_not_found",
    );
  });
});

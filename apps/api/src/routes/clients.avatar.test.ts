/**
 * Tests for the profile-picture endpoints on the /accounts router
 * (routes/clients.ts): PATCH /avatar, DELETE /avatar, GET /avatar-url.
 *
 * Mocking strategy mirrors payouts.test.ts:
 *  - @ligala/db: db() returns a mock conn; schema is a plain stub
 *  - ../middleware/session: requireSession injected as a pass-through that
 *    sets a fixed test user (the IDOR guard keys off user.id)
 *  - ../lib/avatar: resolveImageUrl is a vi.fn() so GET /avatar-url is
 *    deterministic without AWS
 *  - ../lib/sentry: no-op (required by ../middleware/error)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const { mockWhere, mockSet, mockUpdate, mockDb, mockResolveImageUrl, testUser } =
  vi.hoisted(() => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockDb = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockResolveImageUrl = vi.fn();
    const testUser = {
      id: "usr_1",
      role: "client" as const,
      name: "Test Client",
      email: "client@test.com",
      status: "active" as const,
      image: "avatar/usr_1/abc.jpg",
    };
    return { mockWhere, mockSet, mockUpdate, mockDb, mockResolveImageUrl, testUser };
  });

vi.mock("@ligala/db", () => ({
  db: mockDb,
  schema: { user: { id: "id", image: "image" } },
}));

vi.mock("../middleware/session", () => ({
  requireSession: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set("user", testUser);
    await next();
  },
}));

vi.mock("../lib/avatar", () => ({ resolveImageUrl: mockResolveImageUrl }));

vi.mock("../lib/sentry", () => ({
  captureException: vi.fn(),
  initSentry: vi.fn(),
}));

import { clients } from "./clients";
import { errorHandler } from "../middleware/error";

function buildApp() {
  const app = new Hono();
  app.route("/accounts", clients);
  app.onError(errorHandler);
  return app;
}

function req(method: string, path: string, body?: unknown) {
  return buildApp().request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("/accounts avatar endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([]);
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockDb.mockReturnValue({ update: mockUpdate });
  });

  describe("PATCH /accounts/avatar", () => {
    it("stores a key under the caller's own prefix", async () => {
      const res = await req("PATCH", "/accounts/avatar", {
        s3Key: "avatar/usr_1/new.jpg",
      });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const setArgs = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArgs).toMatchObject({ image: "avatar/usr_1/new.jpg" });
      expect(setArgs.updatedAt).toBeInstanceOf(Date);
    });

    it("rejects another user's key (IDOR) and skips the write", async () => {
      const res = await req("PATCH", "/accounts/avatar", {
        s3Key: "avatar/usr_2/theirs.jpg",
      });
      expect(res.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects a key outside the avatar prefix and skips the write", async () => {
      const res = await req("PATCH", "/accounts/avatar", {
        s3Key: "kyc_document/usr_1/secret.pdf",
      });
      expect(res.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns 400 on a missing s3Key", async () => {
      const res = await req("PATCH", "/accounts/avatar", {});
      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /accounts/avatar", () => {
    it("clears the image", async () => {
      const res = await req("DELETE", "/accounts/avatar");
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const setArgs = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArgs).toMatchObject({ image: null });
      expect(setArgs.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("GET /accounts/avatar-url", () => {
    it("resolves the session user's stored image", async () => {
      mockResolveImageUrl.mockResolvedValue("https://signed.example/pic.jpg");
      const res = await req("GET", "/accounts/avatar-url");
      expect(res.status).toBe(200);
      expect(((await res.json()) as { url: string }).url).toBe(
        "https://signed.example/pic.jpg",
      );
      expect(mockResolveImageUrl).toHaveBeenCalledWith("avatar/usr_1/abc.jpg");
    });
  });
});

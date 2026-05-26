import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

const { testUser, hostedUrlFor, insertValues } = vi.hoisted(() => ({
  testUser: { id: "usr_1", role: "lawyer" as const, name: "Atty", email: "a@b.com", status: "active" as const },
  hostedUrlFor: vi.fn(
    (submissionId: string) =>
      `https://web-sdk.idmetagroup.com/?templateId=abc&m=submissionId:${submissionId}`,
  ),
  insertValues: vi.fn(async () => {}),
}));

vi.mock("../middleware/session", () => ({
  requireRole: () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", testUser);
    await next();
  },
  requireSession: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", testUser);
    await next();
  },
}));
vi.mock("../lib/sentry", () => ({ captureException: vi.fn(), initSentry: vi.fn() }));
vi.mock("@ligala/kyc", () => ({ hostedUrlFor }));
vi.mock("@ligala/db", () => ({
  db: () => ({ insert: vi.fn(() => ({ values: insertValues })) }),
  schema: { kycSubmissions: { lawyerId: "lawyer_id", id: "id" } },
}));

import { lawyers } from "./lawyers";
import { errorHandler } from "../middleware/error";

function app() {
  const a = new Hono();
  a.route("/lawyers", lawyers);
  a.onError(errorHandler);
  return a;
}

beforeEach(() => {
  hostedUrlFor.mockClear();
  insertValues.mockClear();
  process.env.IDMETA_HOSTED_URL = "https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314";
});
afterEach(() => {
  delete process.env.IDMETA_HOSTED_URL;
});

describe("POST /lawyers/kyc/idmeta/start", () => {
  it("creates a pending idmeta submission and returns the hosted URL carrying submissionId metadata", async () => {
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hostedUrl: string; submissionId: string };
    expect(typeof body.submissionId).toBe("string");
    expect(body.hostedUrl).toContain(`m=submissionId:${body.submissionId}`);
    expect(hostedUrlFor).toHaveBeenCalledWith(body.submissionId);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ lawyerId: "usr_1", method: "idmeta", status: "pending" }),
    );
  });

  it("returns 501 when IDMETA_HOSTED_URL is not configured", async () => {
    delete process.env.IDMETA_HOSTED_URL;
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(501);
  });
});

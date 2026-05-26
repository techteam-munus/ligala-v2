import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

const { testUser } = vi.hoisted(() => ({
  testUser: { id: "usr_1", role: "lawyer" as const, name: "Atty", email: "a@b.com", status: "active" as const },
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

const { createVerification, hostedUrlFor, insertValues, updateWhere, findFirst } = vi.hoisted(() => ({
  createVerification: vi.fn(async () => ({ verificationId: "ver_1", raw: {} })),
  hostedUrlFor: vi.fn(() => "https://web-sdk.idmetagroup.com/?templateId=abc&verification_id=ver_1"),
  insertValues: vi.fn(async () => {}),
  updateWhere: vi.fn(async () => {}),
  findFirst: vi.fn(async () => null),
}));
vi.mock("@ligala/kyc", () => ({ createVerification, hostedUrlFor }));
vi.mock("@ligala/db", () => ({
  db: () => ({
    query: { kycSubmissions: { findFirst } },
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })),
  }),
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
  createVerification.mockClear();
  hostedUrlFor.mockClear();
  insertValues.mockClear();
  findFirst.mockResolvedValue(null);
  process.env.IDMETA_TOKEN = "tok";
  process.env.IDMETA_TEMPLATE_ID = "tpl_42";
});
afterEach(() => {
  delete process.env.IDMETA_TOKEN;
  delete process.env.IDMETA_TEMPLATE_ID;
  delete process.env.IDMETA_HOSTED_URL;
});

describe("POST /lawyers/kyc/idmeta/start", () => {
  it("creates a submission + IDMeta verification and returns the hosted URL", async () => {
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hostedUrl: string; submissionId: string };
    expect(body.hostedUrl).toContain("verification_id=ver_1");
    expect(typeof body.submissionId).toBe("string");
    expect(createVerification).toHaveBeenCalledWith({ submissionId: body.submissionId });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ lawyerId: "usr_1", method: "idmeta", status: "pending" }),
    );
  });

  it("falls back to the static hosted link when IDMETA_TOKEN is unset (dev)", async () => {
    delete process.env.IDMETA_TOKEN;
    process.env.IDMETA_HOSTED_URL = "https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314";
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hostedUrl: string };
    expect(body.hostedUrl).toBe("https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314");
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("returns 501 when neither token nor hosted URL is configured", async () => {
    delete process.env.IDMETA_TOKEN;
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(501);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createHmac } from "node:crypto";

const { ingestIdmetaResult, enqueueIdmetaIngest } = vi.hoisted(() => ({
  ingestIdmetaResult: vi.fn(async () => ({ submissionId: "sub_1", status: "approved", ingestedDocuments: 2 })),
  enqueueIdmetaIngest: vi.fn(async () => {}),
}));
vi.mock("@ligala/kyc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ligala/kyc")>();
  return { ...actual, ingestIdmetaResult, enqueueIdmetaIngest };
});
vi.mock("../lib/sentry", () => ({ captureException: vi.fn(), initSentry: vi.fn() }));
// billing import pulls in db; stub it so importing webhooks.ts is cheap.
vi.mock("./billing", () => ({ applyPaymentWebhook: vi.fn() }));
vi.mock("@ligala/db", () => ({ db: () => ({}), schema: {} }));

import { webhooks } from "./webhooks";
import { errorHandler } from "../middleware/error";

function app() {
  const a = new Hono();
  a.route("/webhooks", webhooks);
  a.onError(errorHandler);
  return a;
}

const payload = JSON.stringify({
  id: "ver_1",
  status: "VERIFIED",
  metadata: { submissionId: "sub_1" },
  verification_results: { document_verification: { request_data: { imageFrontSide: "data:image/jpeg;base64,/9j/A" } } },
});

beforeEach(() => {
  ingestIdmetaResult.mockClear();
  enqueueIdmetaIngest.mockClear();
  delete process.env.IDMETA_WEBHOOK_SECRET;
  delete process.env.IDMETA_QUEUE_URL;
});
afterEach(() => {
  delete process.env.IDMETA_WEBHOOK_SECRET;
  delete process.env.IDMETA_QUEUE_URL;
});

describe("POST /webhooks/idmeta", () => {
  it("ingests inline when no queue is configured (dev)", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(ingestIdmetaResult).toHaveBeenCalledWith(
      expect.objectContaining({ verificationId: "ver_1", status: "VERIFIED" }),
    );
    expect(enqueueIdmetaIngest).not.toHaveBeenCalled();
  });

  it("enqueues (does not ingest inline) when IDMETA_QUEUE_URL is set", async () => {
    process.env.IDMETA_QUEUE_URL = "https://sqs/idmeta";
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(202);
    expect(enqueueIdmetaIngest).toHaveBeenCalledWith({ verificationId: "ver_1" });
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 401 when a secret is configured", async () => {
    process.env.IDMETA_WEBHOOK_SECRET = "whsec";
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json", "idmeta-signature": "wrong" },
      body: payload,
    });
    expect(res.status).toBe(401);
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });

  it("accepts a valid signature", async () => {
    process.env.IDMETA_WEBHOOK_SECRET = "whsec";
    const sig = createHmac("sha256", "whsec").update(payload).digest("hex");
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json", "idmeta-signature": sig },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(ingestIdmetaResult).toHaveBeenCalled();
  });

  it("400s a payload with no verification id", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "VERIFIED" }),
    });
    expect(res.status).toBe(400);
  });
});

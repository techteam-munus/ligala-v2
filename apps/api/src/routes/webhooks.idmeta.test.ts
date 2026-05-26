import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createHmac } from "node:crypto";

const { ingestIdmetaResult, enqueueIdmetaIngest } = vi.hoisted(() => ({
  ingestIdmetaResult: vi.fn(async () => ({ submissionId: "sub_1", status: "approved", ingestedDocuments: 0 })),
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

// IDMeta's real terminal event shape: { type, data: {...} }.
const payload = JSON.stringify({
  type: "trustValidation.complete",
  data: {
    id: "ver_1",
    status: 3,
    metadata: { submissionId: "sub_1" },
    verification_data: "[]",
  },
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
  it("ingests the completion event inline when no queue is configured (dev)", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(ingestIdmetaResult).toHaveBeenCalledWith(
      expect.objectContaining({ verificationId: "ver_1", submissionId: "sub_1", status: 3 }),
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
    expect(res.status).toBe(200);
    expect(enqueueIdmetaIngest).toHaveBeenCalledWith({
      verificationId: "ver_1",
      submissionId: "sub_1",
      status: 3,
    });
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });

  it("acks (200) and ignores non-terminal events without ingesting", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "trustValidation.create", data: { id: "ver_1", status: 99 } }),
    });
    expect(res.status).toBe(200);
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
    expect(enqueueIdmetaIngest).not.toHaveBeenCalled();
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

  it("400s a completion event with no verification id", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "trustValidation.complete", data: { status: 3 } }),
    });
    expect(res.status).toBe(400);
  });

  it("400s a malformed (non-JSON) body", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    expect(res.status).toBe(400);
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });
});

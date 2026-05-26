/**
 * Tests for the avatar-specific guard added to POST /files/presign
 * (routes/files.ts): the `avatar` kind must be an image, never a PDF. Runs the
 * dev fallback path (no S3_UPLOADS_BUCKET) so no AWS creds are needed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";

const { testUser } = vi.hoisted(() => ({
  testUser: {
    id: "usr_1",
    role: "lawyer" as const,
    name: "Atty",
    email: "atty@test.com",
    status: "active" as const,
  },
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

vi.mock("../lib/sentry", () => ({
  captureException: vi.fn(),
  initSentry: vi.fn(),
}));

import { files } from "./files";
import { errorHandler } from "../middleware/error";

const ORIGINAL_BUCKET = process.env.S3_UPLOADS_BUCKET;

function buildApp() {
  const app = new Hono();
  app.route("/files", files);
  app.onError(errorHandler);
  return app;
}

function presign(body: unknown) {
  return buildApp().request("/files/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /files/presign — avatar guard", () => {
  beforeEach(() => {
    // Force the dev fallback (no real bucket) so we don't touch AWS.
    delete process.env.S3_UPLOADS_BUCKET;
  });
  afterEach(() => {
    if (ORIGINAL_BUCKET === undefined) delete process.env.S3_UPLOADS_BUCKET;
    else process.env.S3_UPLOADS_BUCKET = ORIGINAL_BUCKET;
  });

  it("rejects a PDF avatar with 400", async () => {
    const res = await presign({
      kind: "avatar",
      contentType: "application/pdf",
      byteSize: 1000,
    });
    expect(res.status).toBe(400);
  });

  it("accepts an image avatar and returns a presign body", async () => {
    const res = await presign({
      kind: "avatar",
      contentType: "image/png",
      byteSize: 1000,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { s3Key: string; uploadUrl: string };
    expect(body.s3Key).toMatch(/^avatar\/usr_1\//);
    expect(body.uploadUrl).toContain("/files/_dev/upload");
  });

  it("still allows PDFs for document kinds", async () => {
    const res = await presign({
      kind: "kyc_document",
      contentType: "application/pdf",
      byteSize: 1000,
    });
    expect(res.status).toBe(200);
  });
});

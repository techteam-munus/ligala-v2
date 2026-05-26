/**
 * Tests for resolveImageUrl (lib/avatar.ts). getSignedUrl is mocked so no AWS
 * creds are needed; we only assert the branching: null/http passthrough, the
 * `avatar/`-prefix gate, presigning when a bucket is configured, and the
 * dev-sink fallback when one isn't.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetSignedUrl } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { resolveImageUrl } from "./avatar";

const ORIGINAL_BUCKET = process.env.S3_UPLOADS_BUCKET;
const ORIGINAL_API_URL = process.env.API_URL;

describe("resolveImageUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue("https://signed.example/avatar.jpg?sig=x");
  });

  afterEach(() => {
    if (ORIGINAL_BUCKET === undefined) delete process.env.S3_UPLOADS_BUCKET;
    else process.env.S3_UPLOADS_BUCKET = ORIGINAL_BUCKET;
    if (ORIGINAL_API_URL === undefined) delete process.env.API_URL;
    else process.env.API_URL = ORIGINAL_API_URL;
  });

  it("returns null for null/empty", async () => {
    expect(await resolveImageUrl(null)).toBeNull();
    expect(await resolveImageUrl(undefined)).toBeNull();
    expect(await resolveImageUrl("")).toBeNull();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("passes external http(s) URLs through untouched", async () => {
    expect(await resolveImageUrl("https://lh3.googleusercontent.com/a/x")).toBe(
      "https://lh3.googleusercontent.com/a/x",
    );
    expect(await resolveImageUrl("http://example.com/p.png")).toBe(
      "http://example.com/p.png",
    );
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("refuses to sign keys outside the avatar/ prefix (no read oracle)", async () => {
    process.env.S3_UPLOADS_BUCKET = "ligala-test-uploads";
    expect(await resolveImageUrl("kyc_document/usr_1/secret.pdf")).toBeNull();
    expect(await resolveImageUrl("case_attachment/usr_1/x.pdf")).toBeNull();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("presigns an avatar/ key when a bucket is configured", async () => {
    process.env.S3_UPLOADS_BUCKET = "ligala-test-uploads";
    const url = await resolveImageUrl("avatar/usr_1/abc.jpg");
    expect(url).toBe("https://signed.example/avatar.jpg?sig=x");
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the dev sink when no bucket is configured", async () => {
    delete process.env.S3_UPLOADS_BUCKET;
    process.env.API_URL = "http://localhost:8787";
    const url = await resolveImageUrl("avatar/usr_1/abc.jpg");
    expect(url).toBe(
      "http://localhost:8787/files/_dev/upload?key=avatar%2Fusr_1%2Fabc.jpg",
    );
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});

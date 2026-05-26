import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyIdmetaSignature } from "./signature";

const secret = "whsec_test";
const body = JSON.stringify({ id: "ver_1", status: "VERIFIED" });
const goodSig = createHmac("sha256", secret).update(body).digest("hex");

describe("verifyIdmetaSignature", () => {
  it("returns true when no secret is configured (dev skip)", () => {
    expect(verifyIdmetaSignature(body, goodSig, undefined)).toBe(true);
  });
  it("accepts a valid HMAC-SHA256 hex signature", () => {
    expect(verifyIdmetaSignature(body, goodSig, secret)).toBe(true);
  });
  it("rejects a bad signature", () => {
    expect(verifyIdmetaSignature(body, "deadbeef", secret)).toBe(false);
  });
  it("rejects a missing signature when a secret is set", () => {
    expect(verifyIdmetaSignature(body, null, secret)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { emailMessage } from "./email";

describe("emailMessage", () => {
  it("accepts a valid auth_verify message", () => {
    const r = emailMessage.safeParse({
      kind: "auth_verify", to: "a@b.com", dedupeKey: "auth_verify:u1:abc",
      data: { name: "Ana", verifyUrl: "https://x/verify?token=abc" },
    });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown kind", () => {
    const r = emailMessage.safeParse({ kind: "nope", to: "a@b.com", dedupeKey: "x", data: {} });
    expect(r.success).toBe(false);
  });
  it("rejects invoice_sent missing required data", () => {
    const r = emailMessage.safeParse({
      kind: "invoice_sent", to: "a@b.com", dedupeKey: "invoice_sent:i1",
      data: { clientName: "Ana" },
    });
    expect(r.success).toBe(false);
  });
});

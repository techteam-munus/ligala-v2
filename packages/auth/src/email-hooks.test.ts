import { describe, it, expect, vi } from "vitest";
const dispatch = vi.fn(async () => {});
vi.mock("@ligala/email", () => ({ dispatchEmail: dispatch }));
import { buildVerificationMessage, buildResetMessage } from "./email-hooks";

describe("auth email hooks", () => {
  it("builds an auth_verify message keyed by user + token", () => {
    const m = buildVerificationMessage({ id: "u1", email: "a@b.com", name: "Ana" }, "https://x/verify?token=abc123");
    expect(m.kind).toBe("auth_verify");
    expect(m.to).toBe("a@b.com");
    expect(m.dedupeKey.startsWith("auth_verify:u1:")).toBe(true);
    expect(m.data.verifyUrl).toContain("token=abc123");
  });
  it("builds an auth_reset message", () => {
    const m = buildResetMessage({ id: "u2", email: "c@d.com", name: "Ben" }, "https://x/reset?token=z");
    expect(m.kind).toBe("auth_reset");
    expect(m.dedupeKey.startsWith("auth_reset:u2:")).toBe(true);
  });
});

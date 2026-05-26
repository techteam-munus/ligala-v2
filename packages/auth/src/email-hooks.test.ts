import { describe, it, expect, vi } from "vitest";
const dispatch = vi.fn(async () => {});
vi.mock("@ligala/email", () => ({ dispatchEmail: dispatch }));
import { buildVerificationCodeMessage, buildResetMessage } from "./email-hooks";

describe("auth email hooks", () => {
  it("builds an auth_verify message carrying the code, keyed by email + code", () => {
    const m = buildVerificationCodeMessage("a@b.com", "123456");
    expect(m.kind).toBe("auth_verify");
    expect(m.to).toBe("a@b.com");
    expect(m.dedupeKey.startsWith("auth_verify:a@b.com:")).toBe(true);
    expect(m.data.code).toBe("123456");
  });
  it("produces a distinct dedupeKey per code so resends are not suppressed", () => {
    const a = buildVerificationCodeMessage("a@b.com", "111111");
    const b = buildVerificationCodeMessage("a@b.com", "222222");
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
  });
  it("builds an auth_reset message", () => {
    const m = buildResetMessage({ id: "u2", email: "c@d.com", name: "Ben" }, "https://x/reset?token=z");
    expect(m.kind).toBe("auth_reset");
    expect(m.dedupeKey.startsWith("auth_reset:u2:")).toBe(true);
  });
});

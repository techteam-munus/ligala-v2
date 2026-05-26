import { describe, it, expect } from "vitest";
import { isUndeliverableRecipient } from "./suppress";

describe("isUndeliverableRecipient", () => {
  it("flags reserved, non-deliverable TLDs", () => {
    for (const e of [
      "x@ligala.test",
      "client+a1b2@ligala.test",
      "a@foo.invalid",
      "b@host.example",
      "c@localhost",
      "d@A.TEST", // case-insensitive
      "e@ligala.test.", // trailing dot (FQDN)
    ]) {
      expect(isUndeliverableRecipient(e), e).toBe(true);
    }
  });

  it("allows real domains", () => {
    for (const e of [
      "a@b.com",
      "techteam@mymunus.com",
      "x@gmail.com",
      "y@sub.mymunus.com",
      "z@example.com.ph",
    ]) {
      expect(isUndeliverableRecipient(e), e).toBe(false);
    }
  });

  it("returns false for malformed input", () => {
    expect(isUndeliverableRecipient("no-at")).toBe(false);
    expect(isUndeliverableRecipient("a@")).toBe(false);
    expect(isUndeliverableRecipient("")).toBe(false);
  });
});

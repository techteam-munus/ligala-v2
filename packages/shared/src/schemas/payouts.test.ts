import { describe, it, expect } from "vitest";
import { payoutMethodInput, withdrawalInput } from "./payouts";

describe("payoutMethodInput", () => {
  it("accepts a valid gcash method", () => {
    const r = payoutMethodInput.safeParse({
      type: "gcash",
      accountNumber: "09171234567",
      accountHolderName: "Juan Dela Cruz",
    });
    expect(r.success).toBe(true);
  });

  it("requires bankBic when type is bank", () => {
    const r = payoutMethodInput.safeParse({
      type: "bank",
      accountNumber: "1234567890",
      accountHolderName: "Juan Dela Cruz",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed e-wallet mobile number", () => {
    const r = payoutMethodInput.safeParse({
      type: "maya",
      accountNumber: "12345",
      accountHolderName: "Juan Dela Cruz",
    });
    expect(r.success).toBe(false);
  });
});

describe("withdrawalInput", () => {
  it("accepts a positive integer amount + methodId", () => {
    const r = withdrawalInput.safeParse({ payoutMethodId: "pm_1", amountCents: 50000 });
    expect(r.success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    const r = withdrawalInput.safeParse({ payoutMethodId: "pm_1", amountCents: 0 });
    expect(r.success).toBe(false);
  });
});

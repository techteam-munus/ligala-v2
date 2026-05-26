import { describe, it, expect } from "vitest";
import { mapTransferStatus } from "./transfer-webhook";

describe("mapTransferStatus", () => {
  it("maps provider statuses to payout statuses", () => {
    expect(mapTransferStatus("succeeded")).toBe("succeeded");
    expect(mapTransferStatus("failed")).toBe("failed");
    expect(mapTransferStatus("returned")).toBe("returned");
  });
  it("treats unknown as null (ignore)", () => {
    expect(mapTransferStatus("queued")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { normalizeIdmetaWebhook } from "./webhook";

describe("normalizeIdmetaWebhook", () => {
  it("parses trustValidation.complete (terminal) — id + numeric status from data", () => {
    const n = normalizeIdmetaWebhook({
      type: "trustValidation.complete",
      data: { id: "14f6ef18", status: 3, metadata: null, verification_data: "[]" },
    });
    expect(n.terminal).toBe(true);
    expect(n.verificationId).toBe("14f6ef18");
    expect(n.status).toBe(3);
    expect(n.submissionId).toBeUndefined();
  });

  it("extracts submissionId from data.metadata when present", () => {
    const n = normalizeIdmetaWebhook({
      type: "trustValidation.complete",
      data: { id: "ver_1", status: 3, metadata: { submissionId: "sub_42" } },
    });
    expect(n.submissionId).toBe("sub_42");
    expect(n.terminal).toBe(true);
  });

  it("treats trustValidation.create as non-terminal but still reads metadata", () => {
    const n = normalizeIdmetaWebhook({
      type: "trustValidation.create",
      data: { id: "a9f73c8a", status: 99, metadata: { submissionId: "sub_7" } },
    });
    expect(n.terminal).toBe(false);
    expect(n.submissionId).toBe("sub_7");
  });

  it("reads top-level verification_id (verification.aml shape) but is non-terminal", () => {
    const n = normalizeIdmetaWebhook({ type: "verification.aml", verification_id: "14f6ef18", results: {} });
    expect(n.terminal).toBe(false);
    expect(n.verificationId).toBe("14f6ef18");
  });

  it("is safe on empty / non-object input", () => {
    expect(normalizeIdmetaWebhook(null).terminal).toBe(false);
    expect(normalizeIdmetaWebhook({}).verificationId).toBeUndefined();
  });
});

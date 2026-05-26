import { describe, it, expect } from "vitest";
import { mapIdmetaStatus } from "./status";

describe("mapIdmetaStatus", () => {
  it("maps confirmed string statuses", () => {
    expect(mapIdmetaStatus("VERIFIED")).toBe("approved");
    expect(mapIdmetaStatus("REJECTED")).toBe("rejected");
    expect(mapIdmetaStatus("FAILED")).toBe("rejected");
    expect(mapIdmetaStatus("REVIEW_NEEDED")).toBe("submitted");
    expect(mapIdmetaStatus("INCOMPLETE")).toBe("pending");
    expect(mapIdmetaStatus("IN_PROGRESS")).toBe("pending");
    expect(mapIdmetaStatus("EMPTY")).toBe("pending");
  });

  it("maps confirmed numeric codes", () => {
    expect(mapIdmetaStatus(3)).toBe("approved");
    expect(mapIdmetaStatus(1)).toBe("rejected");
    expect(mapIdmetaStatus(6)).toBe("rejected");
    expect(mapIdmetaStatus(2)).toBe("submitted");
    expect(mapIdmetaStatus(4)).toBe("pending");
    expect(mapIdmetaStatus(5)).toBe("pending");
    expect(mapIdmetaStatus(99)).toBe("pending");
  });

  it("is case-insensitive and tolerant of whitespace", () => {
    expect(mapIdmetaStatus(" verified ")).toBe("approved");
  });

  it("defaults unknown values to submitted (surfaces for admin review)", () => {
    expect(mapIdmetaStatus("WHATEVER")).toBe("submitted");
    expect(mapIdmetaStatus(42)).toBe("submitted");
    expect(mapIdmetaStatus(undefined)).toBe("submitted");
  });
});

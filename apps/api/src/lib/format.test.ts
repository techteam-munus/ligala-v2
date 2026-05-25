import { describe, it, expect } from "vitest";
import { formatPhp, formatDate } from "./format";

describe("formatPhp", () => {
  it("formats integer cents as PHP with 2 decimals", () => {
    expect(formatPhp(550000)).toContain("5,500.00");
    expect(formatPhp(99900)).toContain("999.00");
    expect(formatPhp(0)).toContain("0.00");
  });
});
describe("formatDate", () => {
  it("renders a human date string", () => {
    const s = formatDate(new Date("2026-07-24T00:00:00Z"));
    expect(s.length).toBeGreaterThan(0);
    expect(s).toMatch(/2026/);
  });
});

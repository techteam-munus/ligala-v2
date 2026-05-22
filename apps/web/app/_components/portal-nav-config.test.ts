import { describe, expect, it } from "vitest";
import { isNavActive } from "./portal-nav-config";

describe("isNavActive", () => {
  it("returns true for exact match", () => {
    expect(isNavActive("/cases", "/cases")).toBe(true);
  });

  it("returns true for child routes (prefix match with slash boundary)", () => {
    expect(isNavActive("/cases/abc123", "/cases")).toBe(true);
  });

  it("returns false for unrelated routes", () => {
    expect(isNavActive("/cases", "/dashboard")).toBe(false);
  });

  it("dashboard-suffixed hrefs only match exactly", () => {
    // The Dashboard tab must not light up on /cases, /invoices, etc.
    expect(isNavActive("/lawyer/cases", "/lawyer/dashboard")).toBe(false);
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
  });

  it("does not match on a name-prefix without a slash boundary", () => {
    // /casesfoo must not match /cases
    expect(isNavActive("/casesfoo", "/cases")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { parseTrustedOrigins } from "./trusted-origins";

describe("parseTrustedOrigins", () => {
  it("returns [] for undefined / empty", () => {
    expect(parseTrustedOrigins(undefined)).toEqual([]);
    expect(parseTrustedOrigins("")).toEqual([]);
    expect(parseTrustedOrigins("  ,  ,")).toEqual([]);
  });

  it("splits, trims, and drops blanks", () => {
    expect(
      parseTrustedOrigins(
        "https://dev.ligalaoffice.mymunus.com, https://develop.abc123.amplifyapp.com ,",
      ),
    ).toEqual([
      "https://dev.ligalaoffice.mymunus.com",
      "https://develop.abc123.amplifyapp.com",
    ]);
  });

  it("handles a single origin", () => {
    expect(parseTrustedOrigins("https://dev.ligalaoffice.mymunus.com")).toEqual([
      "https://dev.ligalaoffice.mymunus.com",
    ]);
  });
});

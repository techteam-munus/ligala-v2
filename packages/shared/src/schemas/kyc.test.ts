import { describe, it, expect } from "vitest";
import { idmetaStartResponse } from "./kyc";

describe("idmetaStartResponse", () => {
  it("requires hostedUrl + submissionId", () => {
    expect(
      idmetaStartResponse.parse({ hostedUrl: "https://x/y", submissionId: "sub_1" }),
    ).toEqual({ hostedUrl: "https://x/y", submissionId: "sub_1" });
  });
});

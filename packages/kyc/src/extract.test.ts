import { describe, it, expect } from "vitest";
import { extractImages } from "./extract";

describe("extractImages", () => {
  it("finds base64 document images and classifies front/back as government_id", () => {
    const results = extractImages({
      verification_results: {
        document_verification: {
          request_data: {
            imageFrontSide: "data:image/jpeg;base64,/9j/AAAA",
            imageBackSide: "data:image/png;base64,iVBORw0AAAA",
          },
        },
      },
    });
    expect(results).toContainEqual({
      kind: "government_id",
      ref: "data:image/jpeg;base64,/9j/AAAA",
    });
    expect(results.filter((r) => r.kind === "government_id")).toHaveLength(2);
  });

  it("classifies face/selfie image URLs as selfie", () => {
    const results = extractImages({
      verification_results: {
        biometric_verification: {
          request_result: { face_url: "https://idmeta.example/s3/faces/abc.jpg" },
        },
      },
    });
    expect(results).toContainEqual({
      kind: "selfie",
      ref: "https://idmeta.example/s3/faces/abc.jpg",
    });
  });

  it("ignores non-image strings and dedupes identical refs", () => {
    const results = extractImages({
      profile_name: "JOHN DOE",
      status: "VERIFIED",
      a: { photo: "https://x/p.jpg" },
      b: { photo: "https://x/p.jpg" },
    });
    expect(results).toEqual([{ kind: "selfie", ref: "https://x/p.jpg" }]);
  });

  it("returns [] for null / empty input", () => {
    expect(extractImages(null)).toEqual([]);
    expect(extractImages({})).toEqual([]);
  });
});

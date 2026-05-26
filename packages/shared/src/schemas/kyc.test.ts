import { describe, it, expect } from "vitest";
import { idmetaWebhookPayload, idmetaStartResponse } from "./kyc";

describe("idmetaWebhookPayload", () => {
  it("parses the confirmed IDMeta webhook shape and keeps unknown fields out of the way", () => {
    const parsed = idmetaWebhookPayload.parse({
      id: "ver_123",
      company_id: "co_1",
      template_id: "tpl_1",
      status: "REVIEW_NEEDED",
      metadata: { submissionId: "sub_1" },
      profile_name: "JOHN DOE",
      verification_results: { document_verification: { request_data: {} } },
      some_future_field: true,
    });
    expect(parsed.id).toBe("ver_123");
    expect(parsed.status).toBe("REVIEW_NEEDED");
    expect(parsed.metadata).toEqual({ submissionId: "sub_1" });
  });

  it("accepts verification_id as an alias for id", () => {
    const parsed = idmetaWebhookPayload.parse({ verification_id: "ver_9" });
    expect(parsed.id).toBe("ver_9");
  });

  it("rejects a payload with neither id nor verification_id", () => {
    expect(idmetaWebhookPayload.safeParse({ status: "VERIFIED" }).success).toBe(false);
  });
});

describe("idmetaStartResponse", () => {
  it("requires hostedUrl + submissionId", () => {
    expect(
      idmetaStartResponse.parse({ hostedUrl: "https://x/y", submissionId: "sub_1" }),
    ).toEqual({ hostedUrl: "https://x/y", submissionId: "sub_1" });
  });
});

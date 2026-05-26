import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQSEvent } from "aws-lambda";

const ingestIdmetaResult = vi.hoisted(() =>
  vi.fn(async () => ({ submissionId: "sub_1", status: "approved", ingestedDocuments: 2 }))
);
vi.mock("@ligala/kyc", () => ({ ingestIdmetaResult }));
vi.mock("@ligala/db", () => ({ bootstrapEnv: vi.fn(async () => {}), db: () => ({}), schema: {} }));

import { handler } from "./handler";

function event(bodies: unknown[]): SQSEvent {
  return {
    Records: bodies.map((b, i) => ({ messageId: `m${i}`, body: JSON.stringify(b) })),
  } as unknown as SQSEvent;
}

beforeEach(() => ingestIdmetaResult.mockClear());

describe("idmeta worker", () => {
  it("calls ingestIdmetaResult per record and reports no failures on success", async () => {
    const res = await handler(event([{ verificationId: "ver_1" }, { verificationId: "ver_2" }]));
    expect(ingestIdmetaResult).toHaveBeenCalledTimes(2);
    expect(ingestIdmetaResult).toHaveBeenCalledWith({ verificationId: "ver_1" });
    expect(res.batchItemFailures).toEqual([]);
  });

  it("reports the failing record so SQS retries only it", async () => {
    ingestIdmetaResult.mockRejectedValueOnce(new Error("boom"));
    const res = await handler(event([{ verificationId: "bad" }, { verificationId: "ok" }]));
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m0" }]);
  });

  it("reports a record with an unparseable body as a failure", async () => {
    const res = await handler({ Records: [{ messageId: "m0", body: "{" }] } as unknown as SQSEvent);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m0" }]);
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });
});

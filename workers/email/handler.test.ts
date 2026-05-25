import { describe, it, expect, vi, beforeEach } from "vitest";

const sesSend = vi.fn();
vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn(() => ({ send: sesSend })),
  SendEmailCommand: vi.fn((input) => ({ input })),
}));

const findFirst = vi.fn();
const setWhere = vi.fn(async () => {});
const setSpy = vi.fn(() => ({ where: setWhere }));
const update = vi.fn(() => ({ set: setSpy }));
vi.mock("@ligala/db", () => ({
  bootstrapEnv: vi.fn(async () => {}),
  db: () => ({
    query: { emailLog: { findFirst } },
    update,
    insert: () => ({ values: () => ({ onConflictDoNothing: vi.fn(async () => {}) }) }),
  }),
  schema: { emailLog: { dedupeKey: "dedupe_key", attempts: "attempts" } },
}));
vi.mock("@ligala/email", () => ({ renderEmail: vi.fn(async () => ({ subject: "S", html: "<p>h</p>", text: "h" })) }));

import { handler } from "./handler";

function record(body: unknown, messageId = "m1") {
  return { messageId, body: JSON.stringify(body) } as never;
}
const good = { kind: "auth_verify", to: "a@b.com", dedupeKey: "k1", data: { name: "A", verifyUrl: "https://x/v" } };

beforeEach(() => { sesSend.mockReset(); findFirst.mockReset(); setSpy.mockClear(); setWhere.mockClear(); process.env.EMAIL_FROM = "no-reply@mymunus.com"; });

describe("email worker", () => {
  it("sends and returns no failures on success", async () => {
    findFirst.mockResolvedValue({ status: "queued" });
    sesSend.mockResolvedValue({ MessageId: "ses-1" });
    const res = await handler({ Records: [record(good)] } as never);
    expect(sesSend).toHaveBeenCalledTimes(1);
    expect(res.batchItemFailures).toEqual([]);
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });
  it("skips when already sent (dedupe)", async () => {
    findFirst.mockResolvedValue({ status: "sent" });
    const res = await handler({ Records: [record(good)] } as never);
    expect(sesSend).not.toHaveBeenCalled();
    expect(res.batchItemFailures).toEqual([]);
  });
  it("reports the record as a failure when SES throws", async () => {
    findFirst.mockResolvedValue({ status: "queued" });
    sesSend.mockRejectedValue(new Error("ses down"));
    const res = await handler({ Records: [record(good, "m9")] } as never);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m9" }]);
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
  it("reports malformed bodies as failures", async () => {
    const res = await handler({ Records: [record({ kind: "bogus" }, "mX")] } as never);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "mX" }]);
  });
});

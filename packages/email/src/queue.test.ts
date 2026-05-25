import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({ send })),
  SendMessageCommand: vi.fn((input) => ({ input })),
}));

const values = vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => {}) }));
const insert = vi.fn(() => ({ values }));
vi.mock("@ligala/db", () => ({
  db: () => ({ insert }),
  schema: { emailLog: { dedupeKey: "dedupe_key" } },
}));

import { enqueueEmail, dispatchEmail } from "./queue";
import type { EmailMessage } from "@ligala/shared/schemas";

const msg: EmailMessage = {
  kind: "auth_verify", to: "a@b.com", dedupeKey: "auth_verify:a@b.com:abc",
  data: { code: "123456" },
};

beforeEach(() => { send.mockReset(); values.mockClear(); insert.mockClear(); delete process.env.EMAIL_QUEUE_URL; });

describe("enqueueEmail", () => {
  it("no-ops when EMAIL_QUEUE_URL is unset", async () => {
    await enqueueEmail(msg);
    expect(send).not.toHaveBeenCalled();
  });
  it("sends a SendMessage with the JSON body when configured", async () => {
    process.env.EMAIL_QUEUE_URL = "https://sqs/q";
    send.mockResolvedValue({});
    await enqueueEmail(msg);
    expect(send).toHaveBeenCalledTimes(1);
    const [firstCall] = send.mock.calls;
    const cmd = firstCall?.[0] as { input: { MessageBody: string } };
    expect(JSON.parse(cmd.input.MessageBody)).toMatchObject({ kind: "auth_verify", to: "a@b.com" });
  });
});

describe("dispatchEmail", () => {
  it("queues + enqueues a deliverable recipient", async () => {
    process.env.EMAIL_QUEUE_URL = "https://sqs/q";
    send.mockResolvedValue({});
    await dispatchEmail(msg);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ status: "queued", recipient: "a@b.com" }));
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("records a reserved-TLD (.test) recipient as suppressed and does not enqueue", async () => {
    process.env.EMAIL_QUEUE_URL = "https://sqs/q";
    await dispatchEmail({ ...msg, to: "client+x@ligala.test", dedupeKey: "auth_verify:u2:t" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ status: "suppressed", recipient: "client+x@ligala.test" }));
    expect(send).not.toHaveBeenCalled();
  });
});

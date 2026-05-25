import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({ send })),
  SendMessageCommand: vi.fn((input) => ({ input })),
}));

import { enqueueEmail } from "./queue";
import type { EmailMessage } from "@ligala/shared/schemas";

const msg: EmailMessage = {
  kind: "auth_verify", to: "a@b.com", dedupeKey: "auth_verify:u1:abc",
  data: { name: "Ana", verifyUrl: "https://x/verify?token=abc" },
};

beforeEach(() => { send.mockReset(); delete process.env.EMAIL_QUEUE_URL; });

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

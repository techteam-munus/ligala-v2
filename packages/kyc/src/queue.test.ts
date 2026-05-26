import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({ send })),
  SendMessageCommand: vi.fn((input) => ({ input })),
}));

import { enqueueIdmetaIngest } from "./queue";

beforeEach(() => {
  send.mockReset();
  delete process.env.IDMETA_QUEUE_URL;
});

describe("enqueueIdmetaIngest", () => {
  it("no-ops when IDMETA_QUEUE_URL is unset", async () => {
    await enqueueIdmetaIngest({ verificationId: "ver_1" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a SendMessage with the verificationId body when configured", async () => {
    process.env.IDMETA_QUEUE_URL = "https://sqs/idmeta";
    send.mockResolvedValue({});
    await enqueueIdmetaIngest({ verificationId: "ver_1" });
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0]?.[0] as { input: { MessageBody: string } };
    expect(JSON.parse(cmd.input.MessageBody)).toMatchObject({ verificationId: "ver_1" });
  });
});

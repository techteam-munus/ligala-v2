import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createVerification,
  finalizeVerification,
  hostedUrlFor,
  fetchDocumentBytes,
} from "./idmeta";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.IDMETA_BASE_URL = "https://integrate.idmetagroup.com";
  process.env.IDMETA_TOKEN = "tok_test";
  process.env.IDMETA_TEMPLATE_ID = "tpl_42";
  process.env.IDMETA_HOSTED_URL =
    "https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("createVerification", () => {
  it("POSTs template_id + metadata with the bearer token and returns the verification id", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ verification: { id: "ver_1", status: 99 } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const res = await createVerification({ submissionId: "sub_1" });

    expect(res.verificationId).toBe("ver_1");
    const call0 = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, RequestInit];
    const [url, init] = call0;
    expect(url).toBe(
      "https://integrate.idmetagroup.com/api/v1/verification/create-verification",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok_test");
    expect(JSON.parse(init.body as string)).toEqual({
      template_id: "tpl_42",
      metadata: { submissionId: "sub_1" },
    });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, text: async () => "expired" })),
    );
    await expect(createVerification({ submissionId: "s" })).rejects.toThrow(/403/);
  });
});

describe("finalizeVerification", () => {
  it("POSTs template_id + verification_id and returns the parsed body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 2, status_message: "REVIEW_NEEDED", verification: { id: "ver_1" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await finalizeVerification("ver_1");
    expect(res.status_message).toBe("REVIEW_NEEDED");
    const call0 = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit];
    const [url, init] = call0;
    expect(url).toContain("/finalize-verification");
    expect(JSON.parse(init.body as string)).toEqual({
      template_id: "tpl_42",
      verification_id: "ver_1",
    });
  });
});

describe("hostedUrlFor", () => {
  it("appends submissionId as the m=KEY:VALUE metadata param", () => {
    const out = hostedUrlFor("sub_1");
    expect(out).toContain("https://web-sdk.idmetagroup.com/?templateId=abc");
    expect(out).toContain("m=submissionId:sub_1");
  });
});

describe("fetchDocumentBytes", () => {
  it("decodes a base64 data: URL without a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // "hi" base64 = aGk=
    const { bytes, contentType } = await fetchDocumentBytes("data:image/png;base64,aGk=");
    expect(contentType).toBe("image/png");
    expect(Buffer.from(bytes).toString()).toBe("hi");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("downloads an http URL and reports its content-type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );
    const { bytes, contentType } = await fetchDocumentBytes("https://x/y.jpg");
    expect(contentType).toBe("image/jpeg");
    expect(bytes.length).toBe(3);
  });
});

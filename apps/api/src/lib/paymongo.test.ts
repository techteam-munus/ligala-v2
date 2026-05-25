import { describe, expect, it, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  createCheckoutSession,
  createBatchTransfer,
  verifyWebhookSignature,
  PaymongoApiError,
  PaymongoUnreachableError,
  PaymongoSignatureError,
} from "./paymongo";

const SECRET = "whsk_test_abc123";

function sign(rawBody: string, ts: number, secret = SECRET): string {
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return `t=${ts},te=${sig},li=${sig}`;
}

describe("verifyWebhookSignature", () => {
  it("returns the parsed event when the signature matches", () => {
    const body = JSON.stringify({ data: { attributes: { type: "payment.paid" } } });
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(body, ts);
    const event = verifyWebhookSignature(body, header, SECRET);
    expect(event.data.attributes.type).toBe("payment.paid");
  });

  it("throws PaymongoSignatureError on missing header", () => {
    expect(() => verifyWebhookSignature("{}", undefined, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws on malformed header (missing t=)", () => {
    expect(() => verifyWebhookSignature("{}", "te=abc,li=def", SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws on tampered body", () => {
    const body = JSON.stringify({ data: { attributes: { type: "payment.paid" } } });
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(body, ts);
    expect(() => verifyWebhookSignature(body + "x", header, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws on wrong secret", () => {
    const body = "{}";
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(body, ts, "whsk_wrong");
    expect(() => verifyWebhookSignature(body, header, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("throws when both te and li are missing", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() => verifyWebhookSignature("{}", `t=${ts}`, SECRET)).toThrow(PaymongoSignatureError);
  });

  it("accepts a header with only `li` set (no `te`)", () => {
    const body = JSON.stringify({ data: { attributes: { type: "payment.paid" } } });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex");
    const header = `t=${ts},li=${sig}`;
    const event = verifyWebhookSignature(body, header, SECRET);
    expect(event.data.attributes.type).toBe("payment.paid");
  });
});

describe("createCheckoutSession", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  const VALID_OK_RESPONSE = {
    data: {
      id: "cs_test_xxx",
      type: "checkout_session",
      attributes: { checkout_url: "https://checkout.paymongo.com/cs_test_xxx" },
    },
  };

  function mockFetchOnce(body: unknown, init: { status?: number } = {}) {
    const fn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it("posts a correctly-shaped request and returns sessionId + checkoutUrl", async () => {
    const fetchMock = mockFetchOnce(VALID_OK_RESPONSE);
    const result = await createCheckoutSession({
      secretKey: "sk_test_keyvalue",
      amountCents: 99900,
      currency: "PHP",
      lineDescription: "Ligala — Monthly subscription",
      successUrl: "http://localhost:3000/lawyer/subscribe?status=success",
      cancelUrl: "http://localhost:3000/lawyer/subscribe?status=cancelled",
      referenceNumber: "inv_abc",
      metadata: { invoiceId: "inv_abc", lawyerId: "usr_123" },
      customerEmail: "lawyer@example.test",
    });

    expect(result).toEqual({
      sessionId: "cs_test_xxx",
      checkoutUrl: "https://checkout.paymongo.com/cs_test_xxx",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.paymongo.com/v1/checkout_sessions");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe(
      `Basic ${Buffer.from("sk_test_keyvalue:").toString("base64")}`,
    );
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.data.attributes.line_items).toEqual([
      {
        amount: 99900,
        currency: "PHP",
        name: "Ligala — Monthly subscription",
        quantity: 1,
      },
    ]);
    expect(body.data.attributes.payment_method_types).toEqual([
      "card",
      "gcash",
      "paymaya",
      "grab_pay",
    ]);
    expect(body.data.attributes.success_url).toBe(
      "http://localhost:3000/lawyer/subscribe?status=success",
    );
    expect(body.data.attributes.cancel_url).toBe(
      "http://localhost:3000/lawyer/subscribe?status=cancelled",
    );
    expect(body.data.attributes.reference_number).toBe("inv_abc");
    expect(body.data.attributes.metadata).toEqual({
      invoiceId: "inv_abc",
      lawyerId: "usr_123",
    });
    expect(body.data.attributes.billing?.email).toBe("lawyer@example.test");
    expect(body.data.attributes.send_email_receipt).toBe(true);
  });

  it("throws PaymongoApiError on non-2xx response", async () => {
    mockFetchOnce({ errors: [{ code: "parameter_required" }] }, { status: 400 });
    await expect(
      createCheckoutSession({
        secretKey: "sk_test_x",
        amountCents: 99900,
        currency: "PHP",
        lineDescription: "x",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
        referenceNumber: "r",
        metadata: { invoiceId: "r", lawyerId: "l" },
      }),
    ).rejects.toBeInstanceOf(PaymongoApiError);
  });

  it("throws PaymongoUnreachableError when fetch throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(
      createCheckoutSession({
        secretKey: "sk_test_x",
        amountCents: 99900,
        currency: "PHP",
        lineDescription: "x",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
        referenceNumber: "r",
        metadata: { invoiceId: "r", lawyerId: "l" },
      }),
    ).rejects.toBeInstanceOf(PaymongoUnreachableError);
  });
});

describe("createBatchTransfer", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  function mockOnce(body: unknown, status = 200) {
    const fn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    );
    globalThis.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  const OK = { data: [{ id: "tr_test_123", type: "transfer", attributes: { status: "pending" } }] };

  it("posts a single transfer and returns the transfer id", async () => {
    const fetchMock = mockOnce(OK);
    const res = await createBatchTransfer({
      secretKey: "sk_test_x",
      amountCents: 49000,
      currency: "PHP",
      provider: "instapay",
      sourceAccount: { number: "ACCT", name: "Ligala", bic: "SRCBICXX" },
      destination: { number: "09171234567", name: "Juan Dela Cruz", bic: "GXCHPHM2XXX" },
      referenceNumber: "po_abc",
      callbackUrl: "https://app.test/webhooks/paymongo-transfer",
      idempotencyKey: "po_abc",
    });
    expect(res).toEqual({ transferId: "tr_test_123" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.paymongo.com/v2/batch_transfers");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Basic ${Buffer.from("sk_test_x:").toString("base64")}`);
    expect(headers["Idempotency-Key"]).toBe("po_abc");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.data.attributes.transfers[0].amount).toBe(49000);
    expect(sent.data.attributes.transfers[0].destination_account.number).toBe("09171234567");
  });

  it("throws PaymongoApiError on non-2xx", async () => {
    mockOnce({ errors: [{ code: "x" }] }, 422);
    await expect(
      createBatchTransfer({
        secretKey: "sk_test_x", amountCents: 1, currency: "PHP", provider: "instapay",
        sourceAccount: { number: "A", name: "L" }, destination: { number: "0917", name: "J" },
        referenceNumber: "r", callbackUrl: "https://x/cb", idempotencyKey: "r",
      }),
    ).rejects.toBeInstanceOf(PaymongoApiError);
  });
});

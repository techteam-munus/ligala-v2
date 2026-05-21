import crypto from "node:crypto";

export type PaymongoEvent = {
  data: {
    id: string;
    type: "event";
    attributes: {
      type: string;
      livemode: boolean;
      data: {
        id: string;
        attributes: {
          metadata?: Record<string, string>;
          reference_number?: string;
          total_amount?: number;
          amount?: number;
          last_payment_error?: { message?: string } | null;
          [key: string]: unknown;
        };
      };
    };
  };
};

export class PaymongoSignatureError extends Error {
  constructor(reason: string) {
    super(`paymongo_signature_invalid: ${reason}`);
    this.name = "PaymongoSignatureError";
  }
}

export class PaymongoApiError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(`paymongo_api_error_${status}`);
    this.name = "PaymongoApiError";
  }
}

export class PaymongoUnreachableError extends Error {
  constructor(cause: unknown) {
    super("paymongo_unreachable");
    this.name = "PaymongoUnreachableError";
    this.cause = cause;
  }
}

function parseSignatureHeader(header: string): { t: string; te?: string; li?: string } {
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  if (!out.t) throw new PaymongoSignatureError("missing t");
  return { t: out.t, te: out.te, li: out.li };
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyWebhookSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): PaymongoEvent {
  if (!header) throw new PaymongoSignatureError("no header");
  const { t, te, li } = parseSignatureHeader(header);
  if (!te && !li) throw new PaymongoSignatureError("no te or li");

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const okTest = te ? constantTimeEqualHex(te, expected) : false;
  const okLive = li ? constantTimeEqualHex(li, expected) : false;
  if (!okTest && !okLive) throw new PaymongoSignatureError("mismatch");

  try {
    return JSON.parse(rawBody) as PaymongoEvent;
  } catch {
    throw new PaymongoSignatureError("body_not_json");
  }
}

export type CreateCheckoutSessionInput = {
  secretKey: string;
  amountCents: number;
  currency: "PHP";
  lineDescription: string;
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string;
  metadata: { invoiceId: string; lawyerId: string };
  customerEmail?: string;
};

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ sessionId: string; checkoutUrl: string }> {
  const body = {
    data: {
      attributes: {
        line_items: [
          {
            amount: input.amountCents,
            currency: input.currency,
            name: input.lineDescription,
            quantity: 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference_number: input.referenceNumber,
        metadata: input.metadata,
        send_email_receipt: true,
        description: input.lineDescription,
        ...(input.customerEmail
          ? { billing: { email: input.customerEmail } }
          : {}),
      },
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${input.secretKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new PaymongoUnreachableError(err);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new PaymongoApiError(res.status, text);
  }

  let parsed: {
    data: { id: string; attributes: { checkout_url: string } };
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PaymongoApiError(res.status, text);
  }

  return {
    sessionId: parsed.data.id,
    checkoutUrl: parsed.data.attributes.checkout_url,
  };
}

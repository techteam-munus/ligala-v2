import crypto from "node:crypto";

/**
 * PayMongo's hosted-checkout minimum amount per session (₱20.00 = 2000 cents).
 * Sessions below this fail on creation with a 422 from `/v1/checkout_sessions`.
 * Discount math that drops a total under this triggers a 409 in our routes
 * instead of being deferred to PayMongo for a worse error surface.
 */
export const PAYMONGO_MIN_AMOUNT_CENTS = 2000;

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
          fee?: number;
          net_amount?: number;
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

/**
 * Thrown when PayMongo returns a non-2xx response. `bodyText` may contain
 * PayMongo's error detail including back-echoed input values — only log it
 * at error level or higher, and never surface it to end users.
 */
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

/**
 * Verify a PayMongo webhook signature and return the parsed event payload.
 *
 * Header format: `t=<unix_ts>,te=<test_sig>,li=<live_sig>` where each sig
 * is HMAC-SHA256 of `${t}.${rawBody}` hex-encoded with `secret`. Either
 * `te` or `li` matching is sufficient; we accept whichever is present.
 *
 * **No timestamp-freshness check by design.** PayMongo retries failed
 * deliveries with exponential backoff over hours or days. Rejecting old
 * timestamps would silently break those retries. Replay protection is
 * enforced one layer up by the DB-level idempotency index on
 * `(provider, provider_payment_id)` in `applyPaymentWebhook` — a replayed
 * event resolves to the same `cs_xxx` / `pay_xxx` id and is no-op'd.
 */
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
        // PayMongo requires this on the request; values must match methods
        // enabled on the merchant account. These are the standard PH set.
        payment_method_types: ["card", "gcash", "paymaya", "grab_pay"],
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
    data?: { id?: string; attributes?: { checkout_url?: string } };
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PaymongoApiError(res.status, text);
  }

  const sessionId = parsed?.data?.id;
  const checkoutUrl = parsed?.data?.attributes?.checkout_url;
  if (!sessionId || !checkoutUrl) {
    throw new PaymongoApiError(res.status, text);
  }

  return { sessionId, checkoutUrl };
}

export type BatchTransferAccount = { number: string; name: string; bic?: string };

export type CreateBatchTransferInput = {
  secretKey: string;
  amountCents: number;
  currency: "PHP";
  provider: "instapay" | "pesonet";
  sourceAccount: BatchTransferAccount;
  destination: BatchTransferAccount;
  referenceNumber: string;
  callbackUrl: string;
  idempotencyKey: string;
};

/**
 * Create a single disbursement via PayMongo Money Movement batch_transfers.
 *
 * NOTE: shape is best-effort and MUST be confirmed against the PayMongo
 * sandbox (Idempotency-Key header, source_account requirement, response id
 * location). We send one transfer per withdrawal.
 */
export async function createBatchTransfer(
  input: CreateBatchTransferInput,
): Promise<{ transferId: string }> {
  const body = {
    data: {
      attributes: {
        transfers: [
          {
            amount: input.amountCents,
            currency: input.currency,
            provider: input.provider,
            source_account: {
              number: input.sourceAccount.number,
              name: input.sourceAccount.name,
              ...(input.sourceAccount.bic ? { bic: input.sourceAccount.bic } : {}),
            },
            destination_account: {
              number: input.destination.number,
              name: input.destination.name,
              ...(input.destination.bic ? { bic: input.destination.bic } : {}),
            },
            reference_number: input.referenceNumber,
            callback_url: input.callbackUrl,
          },
        ],
      },
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.paymongo.com/v2/batch_transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${input.secretKey}:`).toString("base64")}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new PaymongoUnreachableError(err);
  }

  const text = await res.text();
  if (!res.ok) throw new PaymongoApiError(res.status, text);

  let parsed: { data?: Array<{ id?: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PaymongoApiError(res.status, text);
  }
  const transferId = parsed?.data?.[0]?.id;
  if (!transferId) throw new PaymongoApiError(res.status, text);
  return { transferId };
}

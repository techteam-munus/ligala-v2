const DEFAULT_BASE_URL = "https://integrate.idmetagroup.com";

function baseUrl(): string {
  return (process.env.IDMETA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function token(): string {
  const t = process.env.IDMETA_TOKEN;
  if (!t) throw new Error("IDMETA_TOKEN is not configured");
  return t;
}

function templateId(): string {
  const t = process.env.IDMETA_TEMPLATE_ID;
  if (!t) throw new Error("IDMETA_TEMPLATE_ID is not configured");
  return t;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`idmeta ${path} failed: ${res.status} ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface CreateVerificationResult {
  verificationId: string;
  /** Full parsed response — `hostedUrlFor` inspects it for a session URL. */
  raw: Record<string, unknown>;
}

/** create-verification: stash our submissionId in metadata so it round-trips. */
export async function createVerification(opts: {
  submissionId: string;
}): Promise<CreateVerificationResult> {
  const raw = await post<Record<string, unknown>>(
    "/api/v1/verification/create-verification",
    { template_id: templateId(), metadata: { submissionId: opts.submissionId } },
  );
  const verification = (raw.verification ?? {}) as { id?: unknown };
  const id = typeof verification.id === "string" ? verification.id : undefined;
  if (!id) throw new Error("idmeta create-verification returned no verification id");
  return { verificationId: id, raw };
}

/** finalize-verification: authoritative status/result backstop. */
export async function finalizeVerification(
  verificationId: string,
): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>("/api/v1/verification/finalize-verification", {
    template_id: templateId(),
    verification_id: verificationId,
  });
}

/**
 * Build the hosted-SDK URL the lawyer opens, attaching our submissionId as
 * IDMeta metadata via the `m=KEY:VALUE` param. This is the mechanism the v1
 * integration uses (`&m=userID:<id>`): the value round-trips into the
 * verification's `metadata` and comes back in the `trustValidation.complete`
 * webhook, which is how we map the completion to the right lawyer. The SDK
 * creates its own verification, so we don't pre-create one.
 *
 * The `:` is intentionally NOT URL-encoded — IDMeta expects the literal
 * `m=KEY:VALUE` shape (submissionId is a UUID, so it's URL-safe as-is).
 */
export function hostedUrlFor(submissionId: string): string {
  const base = process.env.IDMETA_HOSTED_URL;
  if (!base) throw new Error("IDMETA_HOSTED_URL is not configured");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}m=submissionId:${submissionId}`;
}

export interface DocumentBytes {
  bytes: Uint8Array;
  contentType: string;
}

/** Resolve an image ref (http URL or data: URL) to raw bytes + content type. */
export async function fetchDocumentBytes(ref: string): Promise<DocumentBytes> {
  if (ref.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(ref);
    if (!match) throw new Error("malformed data URL");
    const contentType = match[1] ?? "application/octet-stream";
    const isBase64 = !!match[2];
    const data = match[3] ?? "";
    const bytes = isBase64
      ? new Uint8Array(Buffer.from(data, "base64"))
      : new Uint8Array(Buffer.from(decodeURIComponent(data), "utf-8"));
    return { bytes, contentType };
  }
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${ref.slice(0, 120)}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), contentType };
}

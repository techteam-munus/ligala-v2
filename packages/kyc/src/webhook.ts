/**
 * Normalizes an IDMeta verification webhook into the few fields we act on.
 *
 * IDMeta wraps events as `{ type, data: {...} }` (confirmed from live captures):
 *   - trustValidation.create   → a verification was created (data.metadata may
 *                                 carry our submissionId)
 *   - trustValidation.complete → TERMINAL: data.status is the final code
 *                                 (3 = verified, 1 = rejected, …)
 *   - verification.<check>     → per-step results (biometrics, aml, …)
 *
 * Only `trustValidation.complete` drives reconciliation; everything else is
 * acknowledged and ignored. We read fields defensively because the exact shape
 * varies per event type.
 */
export interface NormalizedIdmetaEvent {
  type: string | undefined;
  /** True only for the terminal completion event. */
  terminal: boolean;
  verificationId: string | undefined;
  status: string | number | undefined;
  /** Our reference, echoed back from create-time metadata (if present). */
  submissionId: string | undefined;
  /** Object to scan for captured document/biometric images. */
  results: unknown;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

/**
 * Extract our submissionId from IDMeta's echoed metadata. We pass it via the
 * `m=submissionId:<id>` SDK param, and IDMeta returns it as either an object
 * (`{ submissionId: "..." }`) or a string (`"submissionId:..."`, JSON, or the
 * raw value). Mirrors the defensive parsing the v1 integration uses.
 */
function extractSubmissionId(metadata: unknown): string | undefined {
  if (!metadata) return undefined;
  if (typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    if (typeof m.submissionId === "string" && m.submissionId.length > 0) return m.submissionId;
    const first = Object.values(m).find((v) => typeof v === "string" && v.length > 0);
    return typeof first === "string" ? first : undefined;
  }
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>;
      const fromObj = extractSubmissionId(parsed);
      if (fromObj) return fromObj;
    } catch {
      /* not JSON — fall through to KEY:VALUE / raw handling */
    }
    const colon = metadata.indexOf(":");
    const raw = (colon >= 0 ? metadata.slice(colon + 1) : metadata)
      .replace(/^["{]+|["}]+$/g, "")
      .trim();
    return raw.length > 0 ? raw : undefined;
  }
  return undefined;
}

export function normalizeIdmetaWebhook(body: unknown): NormalizedIdmetaEvent {
  const evt = asRecord(body);
  const type = typeof evt.type === "string" ? evt.type : undefined;
  // Most events nest the verification under `data`; some (verification.aml)
  // put fields at the top level — fall back to the envelope itself.
  const data = evt.data && typeof evt.data === "object" ? asRecord(evt.data) : evt;

  const status =
    (typeof data.status === "string" || typeof data.status === "number"
      ? data.status
      : undefined) ??
    (typeof evt.status === "string" || typeof evt.status === "number"
      ? evt.status
      : undefined) ??
    (typeof evt.verificationStatusCode === "number"
      ? evt.verificationStatusCode
      : undefined);

  return {
    type,
    terminal: type === "trustValidation.complete",
    verificationId: firstString(
      data.id,
      data.verification_id,
      data.trustValidationId,
      evt.verification_id,
      evt.trustValidationId,
      evt.id,
    ),
    status,
    submissionId: extractSubmissionId(data.metadata ?? evt.metadata),
    results: data.verification_results ?? data.verification_data ?? data,
  };
}

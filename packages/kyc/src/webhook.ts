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

export function normalizeIdmetaWebhook(body: unknown): NormalizedIdmetaEvent {
  const evt = asRecord(body);
  const type = typeof evt.type === "string" ? evt.type : undefined;
  // Most events nest the verification under `data`; some (verification.aml)
  // put fields at the top level — fall back to the envelope itself.
  const data = evt.data && typeof evt.data === "object" ? asRecord(evt.data) : evt;
  const meta = asRecord(data.metadata).submissionId
    ? asRecord(data.metadata)
    : asRecord(evt.metadata);

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
    submissionId: firstString(meta.submissionId),
    results: data.verification_results ?? data.verification_data ?? data,
  };
}

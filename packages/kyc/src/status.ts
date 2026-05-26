export type KycStatus = "pending" | "submitted" | "approved" | "rejected";

// IDMeta status codes (confirmed via Postman collection):
//   1 Rejected · 2 Review Needed · 3 Verified · 4 Incomplete
//   5 In Progress · 6 Failed · 99 Empty (created, no actions)
const BY_CODE: Record<number, KycStatus> = {
  1: "rejected",
  2: "submitted",
  3: "approved",
  4: "pending",
  5: "pending",
  6: "rejected",
  99: "pending",
};

const BY_NAME: Record<string, KycStatus> = {
  REJECTED: "rejected",
  REVIEW_NEEDED: "submitted",
  VERIFIED: "approved",
  INCOMPLETE: "pending",
  IN_PROGRESS: "pending",
  FAILED: "rejected",
  EMPTY: "pending",
};

/**
 * Normalize an IDMeta status (string message like "REVIEW_NEEDED" or numeric
 * code) to our kyc_status. Unknown values default to "submitted" so a
 * verification we can't classify still surfaces for manual admin review rather
 * than silently approving/rejecting.
 */
export function mapIdmetaStatus(status: string | number | undefined): KycStatus {
  if (typeof status === "number") return BY_CODE[status] ?? "submitted";
  if (typeof status === "string") {
    const key = status.trim().toUpperCase();
    return BY_NAME[key] ?? "submitted";
  }
  return "submitted";
}

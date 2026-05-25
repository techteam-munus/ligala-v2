/** PayMongo per-transfer disbursement fee: PHP 10.00 = 1000 cents. */
export const PAYOUT_FEE_CENTS = 1000;

export type LedgerLine = {
  direction: "credit" | "debit";
  amountCents: number;
  clearsAt: Date;
};

export function signedCents(e: Pick<LedgerLine, "direction" | "amountCents">): number {
  return e.direction === "credit" ? e.amountCents : -e.amountCents;
}

/** Earnings (and their paired processing fee) clear after the window; everything else is immediate. */
export function clearsAtForEarning(now: Date, clearingDays: number): Date {
  return new Date(now.getTime() + clearingDays * 86_400_000);
}

/**
 * Compute the withdrawable + pending balance from ledger lines.
 *   available = signed sum of lines whose clears_at <= now
 *   pending   = signed sum of the rest
 */
export function computeBalance(
  lines: LedgerLine[],
  now: Date,
): { availableCents: number; pendingCents: number } {
  let availableCents = 0;
  let pendingCents = 0;
  for (const line of lines) {
    const s = signedCents(line);
    if (line.clearsAt.getTime() <= now.getTime()) availableCents += s;
    else pendingCents += s;
  }
  return { availableCents, pendingCents };
}

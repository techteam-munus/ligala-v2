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

export type WithdrawCheck =
  | { ok: true }
  | { ok: false; error: "amount_below_minimum" | "insufficient_balance" | "amount_invalid" };

export function checkWithdrawable(args: {
  requestCents: number;
  availableCents: number;
  minCents: number;
}): WithdrawCheck {
  if (!Number.isInteger(args.requestCents) || args.requestCents <= 0) {
    return { ok: false, error: "amount_invalid" };
  }
  if (args.requestCents < args.minCents) return { ok: false, error: "amount_below_minimum" };
  if (args.requestCents > args.availableCents) return { ok: false, error: "insufficient_balance" };
  return { ok: true };
}

/**
 * Net amount to claw back from a lawyer's balance on refund: the net that was
 * credited (gross - processing fee), pro-rata to the refunded fraction of gross.
 * PayMongo does not return its collection fee on refunds, so we reverse net, not gross.
 */
export function refundReversalCents(args: {
  grossCents: number;
  processingFeeCents: number;
  refundedGrossCents: number;
}): number {
  if (args.grossCents <= 0) return 0;
  const net = args.grossCents - args.processingFeeCents;
  return Math.round(net * (args.refundedGrossCents / args.grossCents));
}

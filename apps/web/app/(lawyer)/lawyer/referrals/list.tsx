"use client";

import { useState, useTransition } from "react";
import { decideOnReferral } from "@/lib/actions/referral";

type Referral = {
  id: string;
  kind: "case_referral" | "link_signup";
  fromLawyerId: string;
  toLawyerId: string;
  caseId: string | null;
  linkId: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  noteMd: string | null;
  declineReason: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export function ReferralsList({
  items,
  side,
  meId,
}: {
  items: Referral[];
  side: "inbound" | "outbound";
  meId: string;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-neutral-500">Nothing here yet.</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {items.map((r) => (
        <Row key={r.id} r={r} side={side} meId={meId} />
      ))}
    </ul>
  );
}

function Row({ r, side, meId }: { r: Referral; side: "inbound" | "outbound"; meId: string }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canDecide =
    side === "inbound" &&
    r.status === "pending" &&
    r.kind === "case_referral" &&
    r.toLawyerId === meId;

  function decide(decision: "accept" | "decline") {
    setError(null);
    start(async () => {
      try {
        await decideOnReferral(r.id, { decision, reason: reason || undefined });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <li className="rounded border border-neutral-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {r.kind === "case_referral" ? "Case referral" : "Link signup"}
            <span className="ml-2 text-xs text-neutral-500">{r.status}</span>
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {new Date(r.createdAt).toLocaleString()}
          </p>
        </div>
        {r.caseId ? (
          <a
            href={`/lawyer/cases/${r.caseId}`}
            className="text-xs underline"
          >
            Open case
          </a>
        ) : null}
      </div>
      {r.noteMd ? (
        <p className="mt-2 whitespace-pre-wrap text-sm">{r.noteMd}</p>
      ) : null}
      {r.declineReason ? (
        <p className="mt-2 text-xs text-neutral-500">
          Declined: {r.declineReason}
        </p>
      ) : null}
      {canDecide ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Decline reason (optional)"
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm sm:flex-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("accept")}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("decline")}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </li>
  );
}

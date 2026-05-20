"use client";

import { useState, useTransition } from "react";
import { decideOnKyc } from "@/lib/actions/admin";

type Row = {
  submission: {
    id: string;
    lawyerId: string;
    status: string;
    createdAt: string;
  };
  lawyerEmail: string;
  lawyerName: string;
};

export function KycInbox({ items }: { items: Row[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((r) => (
        <Item key={r.submission.id} row={r} />
      ))}
    </ul>
  );
}

function Item({ row }: { row: Row }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function decide(decision: "approve" | "reject") {
    setErr(null);
    start(async () => {
      try {
        await decideOnKyc(row.submission.id, {
          decision,
          reason: reason || undefined,
        });
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <li className="rounded border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{row.lawyerName}</p>
          <p className="text-xs text-neutral-500">{row.lawyerEmail}</p>
        </div>
        <p className="text-xs text-neutral-500">
          {new Date(row.submission.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required for reject)"
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm sm:flex-1"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("approve")}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("reject")}
            className="rounded border border-red-500 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
      {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
    </li>
  );
}

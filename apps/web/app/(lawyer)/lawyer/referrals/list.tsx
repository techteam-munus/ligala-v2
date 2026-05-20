"use client";

import { useState, useTransition } from "react";
import { decideOnReferral } from "@/lib/actions/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
    return <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>;
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
    <li>
      <Card className="gap-2 py-3">
        <CardContent className="px-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                {r.kind === "case_referral" ? "Case referral" : "Link signup"}
                <Badge variant="secondary">{r.status}</Badge>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
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
            <p className="mt-2 text-xs text-muted-foreground">
              Declined: {r.declineReason}
            </p>
          ) : null}
          {canDecide ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Decline reason (optional)"
                className="sm:flex-1"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => decide("accept")}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => decide("decline")}
                >
                  Decline
                </Button>
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </li>
  );
}

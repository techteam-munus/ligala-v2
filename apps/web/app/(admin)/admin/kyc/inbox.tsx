"use client";

import { useState, useTransition } from "react";
import { decideOnKyc } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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
    <li>
      <Card className="gap-2 py-3">
        <CardContent className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{row.lawyerName}</p>
              <p className="text-xs text-muted-foreground">{row.lawyerEmail}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(row.submission.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required for reject)"
              className="sm:flex-1"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => decide("approve")}
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => decide("reject")}
                className="border-destructive text-destructive hover:text-destructive"
              >
                Reject
              </Button>
            </div>
          </div>
          {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
        </CardContent>
      </Card>
    </li>
  );
}

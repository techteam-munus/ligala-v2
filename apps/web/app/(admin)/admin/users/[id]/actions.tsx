"use client";

import { useState, useTransition } from "react";
import { forceVerifyLawyer, setUserRole, setUserStatus } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "active" | "paused" | "banned";
type Role = "client" | "lawyer" | "admin";

export function UserActions({
  userId,
  currentRole,
  currentStatus,
  forceVerifyEnabled = false,
}: {
  userId: string;
  currentRole: Role;
  currentStatus: Status;
  forceVerifyEnabled?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function changeStatus(status: Status) {
    if (status === currentStatus) return;
    setErr(null);
    setOk(null);
    if (reason.trim().length < 3) {
      setErr("Reason is required (min 3 chars).");
      return;
    }
    start(async () => {
      try {
        await setUserStatus(userId, { status, reason });
        setOk(`status → ${status}`);
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function changeRole(role: Role) {
    if (role === currentRole) return;
    setErr(null);
    setOk(null);
    if (reason.trim().length < 3) {
      setErr("Reason is required (min 3 chars).");
      return;
    }
    start(async () => {
      try {
        await setUserRole(userId, { role, reason });
        setOk(`role → ${role}`);
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function forceVerify() {
    setErr(null);
    setOk(null);
    if (reason.trim().length < 3) {
      setErr("Reason is required (min 3 chars).");
      return;
    }
    start(async () => {
      try {
        const res = await forceVerifyLawyer(userId, { reason });
        setOk(res.alreadyVerified ? "already verified — no change" : "force-verified ✓");
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <Card className="mt-6 gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason (required for any change)</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this change being made?"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || currentStatus === "active"}
            onClick={() => changeStatus("active")}
          >
            Restore
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || currentStatus === "paused"}
            onClick={() => changeStatus("paused")}
            className="border-amber-500 text-amber-700 hover:text-amber-800"
          >
            Pause (writes blocked)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || currentStatus === "banned"}
            onClick={() => changeStatus("banned")}
            className="border-destructive text-destructive hover:text-destructive"
          >
            Ban (all access blocked)
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Role:</span>
          {(["client", "lawyer", "admin"] as Role[]).map((r) => (
            <Button
              key={r}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || r === currentRole}
              onClick={() => changeRole(r)}
            >
              {r}
            </Button>
          ))}
        </div>
        {forceVerifyEnabled && currentRole === "lawyer" ? (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Testing tools (dev/staging)
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={forceVerify}
              className="mt-2 border-dashed"
            >
              Force verify lawyer (no KYC)
            </Button>
          </div>
        ) : null}
        {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
        {ok ? <p className="mt-2 text-sm text-green-700">{ok}</p> : null}
      </CardContent>
    </Card>
  );
}

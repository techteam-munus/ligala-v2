"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Pause,
  Play,
  ShieldOff,
  Sparkles,
  UserCog,
} from "lucide-react";
import {
  forceVerifyLawyer,
  setUserRole,
  setUserStatus,
} from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
        setOk(`Status → ${status}`);
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
        setOk(`Role → ${role}`);
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
        setOk(
          res.alreadyVerified
            ? "Already verified — no change."
            : "Force-verified ✓",
        );
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const reasonOk = reason.trim().length >= 3;

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="flex-row items-center gap-2">
        <UserCog className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Actions
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reason input — required for every action */}
        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-xs">
            Reason · required, min 3 chars
          </Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this change being made?"
            aria-invalid={!reasonOk && reason.length > 0 ? true : undefined}
          />
        </div>

        {/* Status actions */}
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Status
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || currentStatus === "active" || !reasonOk}
              onClick={() => changeStatus("active")}
              className="border-emerald-300/60 text-emerald-700 hover:bg-emerald-50/50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-950/30 disabled:opacity-40"
            >
              <Play />
              Restore
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || currentStatus === "paused" || !reasonOk}
              onClick={() => changeStatus("paused")}
              className="border-amber-300/60 text-amber-700 hover:bg-amber-50/50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-950/30 disabled:opacity-40"
            >
              <Pause />
              Pause
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || currentStatus === "banned" || !reasonOk}
              onClick={() => changeStatus("banned")}
              className="border-rose-300/60 text-rose-700 hover:bg-rose-50/50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/30 disabled:opacity-40"
            >
              <ShieldOff />
              Ban
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Paused = writes blocked. Banned = all access blocked.
          </p>
        </div>

        {/* Role actions */}
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Role
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["client", "lawyer", "admin"] as Role[]).map((r) => (
              <Button
                key={r}
                type="button"
                variant={r === currentRole ? "secondary" : "outline"}
                size="sm"
                disabled={pending || r === currentRole || !reasonOk}
                onClick={() => changeRole(r)}
                className="capitalize disabled:opacity-50"
              >
                {r === currentRole ? <CheckCircle2 /> : null}
                {r}
              </Button>
            ))}
          </div>
        </div>

        {/* Dev-only: force verify */}
        {forceVerifyEnabled && currentRole === "lawyer" ? (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Sparkles className="mr-1 inline size-3" />
              Testing tools · dev/staging
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !reasonOk}
              onClick={forceVerify}
              className="w-full border-dashed disabled:opacity-50"
            >
              Force-verify lawyer · no KYC
            </Button>
          </div>
        ) : null}

        {err ? (
          <p
            className={cn(
              "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
            )}
          >
            {err}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-md border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {ok}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

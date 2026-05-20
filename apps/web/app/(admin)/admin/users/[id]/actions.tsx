"use client";

import { useState, useTransition } from "react";
import { setUserRole, setUserStatus } from "@/lib/actions/admin";

type Status = "active" | "paused" | "banned";
type Role = "client" | "lawyer" | "admin";

export function UserActions({
  userId,
  currentRole,
  currentStatus,
}: {
  userId: string;
  currentRole: Role;
  currentStatus: Status;
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

  return (
    <section className="mt-6 rounded border border-neutral-200 p-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        Actions
      </h2>
      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="font-medium">Reason (required for any change)</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this change being made?"
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || currentStatus === "active"}
          onClick={() => changeStatus("active")}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Restore
        </button>
        <button
          type="button"
          disabled={pending || currentStatus === "paused"}
          onClick={() => changeStatus("paused")}
          className="rounded border border-amber-500 px-3 py-1.5 text-sm text-amber-700 disabled:opacity-40"
        >
          Pause (writes blocked)
        </button>
        <button
          type="button"
          disabled={pending || currentStatus === "banned"}
          onClick={() => changeStatus("banned")}
          className="rounded border border-red-500 px-3 py-1.5 text-sm text-red-700 disabled:opacity-40"
        >
          Ban (all access blocked)
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Role:</span>
        {(["client", "lawyer", "admin"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending || r === currentRole}
            onClick={() => changeRole(r)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {r}
          </button>
        ))}
      </div>
      {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
      {ok ? <p className="mt-2 text-sm text-green-700">{ok}</p> : null}
    </section>
  );
}

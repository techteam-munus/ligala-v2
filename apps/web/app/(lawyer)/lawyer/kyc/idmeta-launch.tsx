"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { startIdmetaVerification } from "@/lib/actions/lawyer";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function IdmetaLaunch() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  function onClick() {
    setError(null);
    start(async () => {
      try {
        const { hostedUrl } = await startIdmetaVerification();
        window.open(hostedUrl, "_blank", "noopener,noreferrer");
        setLaunched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start verification.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        {pending ? "Starting…" : "Start IDMeta verification"}
        {!pending ? <ExternalLink className="opacity-70" /> : null}
      </Button>
      {launched ? (
        <p className="text-xs text-muted-foreground">
          Verification opened in a new tab. Complete it there — this page updates
          once IDMeta finishes processing (you may need to refresh).
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, FileCheck2, FileUp, IdCard, ImageIcon, Loader2 } from "lucide-react";
import { submitKyc } from "@/lib/actions/lawyer";
import type { KycSubmissionInput } from "@ligala/shared/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type DocKind = KycSubmissionInput["documents"][number]["kind"];

const KINDS: {
  value: DocKind;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "government_id",
    label: "Government ID",
    description: "PhilSys, driver's license, or passport · image or PDF",
    icon: <IdCard className="size-4" />,
  },
  {
    value: "bar_certificate",
    label: "Bar certificate",
    description: "Roll of attorneys or IBP membership · PDF preferred",
    icon: <FileCheck2 className="size-4" />,
  },
  {
    value: "selfie",
    label: "Selfie",
    description: "Front-facing, well-lit, no filters · image",
    icon: <ImageIcon className="size-4" />,
  },
];

export function KycForm({ allowResubmit }: { allowResubmit: boolean }) {
  const [docs, setDocs] = useState<Record<DocKind, string>>({
    government_id: "",
    bar_certificate: "",
    selfie: "",
    other: "",
  });
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function presign(kind: DocKind, file: File) {
    const res = await fetch(`/api/files/presign-proxy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "kyc_document",
        contentType: file.type,
        byteSize: file.size,
      }),
    });
    if (!res.ok) throw new Error(`presign failed: ${res.status}`);
    const { uploadUrl, s3Key } = (await res.json()) as {
      uploadUrl: string;
      s3Key: string;
    };

    const put = await fetch(uploadUrl, { method: "PUT", body: file });
    if (!put.ok) throw new Error(`upload failed: ${put.status}`);

    setDocs((prev) => ({ ...prev, [kind]: s3Key }));
  }

  async function onFile(
    kind: DocKind,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(kind);
    try {
      await presign(kind, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const documents = KINDS.flatMap((k) =>
      docs[k.value] ? [{ kind: k.value, s3Key: docs[k.value] }] : [],
    );
    if (documents.length === 0) {
      setError("Upload at least one document.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await submitKyc({ documents });
        setResult(
          `Submitted (${res.submissionId.slice(0, 8)}…). Status: ${res.status}.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submit failed");
      }
    });
  }

  if (!allowResubmit) {
    return (
      <Card size="sm" className="ring-amber-200/70 dark:ring-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent>
          <p className="text-sm">
            Your submission is in review. You&apos;ll be able to resubmit if
            it&apos;s rejected.
          </p>
        </CardContent>
      </Card>
    );
  }

  const uploaded = KINDS.filter((k) => docs[k.value]).length;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-3">
        {KINDS.map((k) => {
          const filename = docs[k.value]?.split("/").pop();
          const isUploaded = !!docs[k.value];
          const isUploading = uploading === k.value;
          return (
            <Card
              key={k.value}
              size="sm"
              className={cn(
                "gap-0 transition-colors",
                isUploaded &&
                  "ring-emerald-300/70 bg-emerald-50/30 dark:ring-emerald-900/40 dark:bg-emerald-950/20",
              )}
            >
              <CardContent>
                <label
                  htmlFor={`file-${k.value}`}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3",
                    (isUploading || isPending) && "cursor-wait opacity-70",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md ring-1",
                        isUploaded
                          ? "bg-emerald-500/15 text-emerald-700 ring-emerald-200/60 dark:text-emerald-300 dark:ring-emerald-900/40"
                          : "bg-muted text-muted-foreground ring-border/60",
                      )}
                    >
                      {isUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isUploaded ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        k.icon
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{k.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {isUploaded
                          ? `Uploaded · ${filename}`
                          : k.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium",
                      isUploaded
                        ? "border-emerald-200/60 bg-background text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-300"
                        : "border-border bg-background text-foreground",
                    )}
                  >
                    <FileUp className="size-3" />
                    {isUploaded ? "Replace" : "Upload"}
                  </span>
                  <input
                    id={`file-${k.value}`}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => onFile(k.value, e)}
                    className="hidden"
                    disabled={isUploading || isPending}
                  />
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result ? (
        <Alert className="border-emerald-200/60 bg-emerald-50/30 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
          <AlertDescription>{result}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {uploaded}/{KINDS.length}
          </span>{" "}
          documents uploaded.
        </p>
        <Button type="submit" disabled={isPending || uploaded === 0}>
          {isPending ? "Submitting…" : "Submit for verification"}
        </Button>
      </div>
    </form>
  );
}

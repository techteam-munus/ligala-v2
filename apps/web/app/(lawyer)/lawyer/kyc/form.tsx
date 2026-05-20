"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitKyc } from "@/lib/actions/lawyer";
import type { KycSubmissionInput } from "@ligala/shared/schemas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type DocKind = KycSubmissionInput["documents"][number]["kind"];

const KINDS: { value: DocKind; label: string }[] = [
  { value: "government_id", label: "Government ID" },
  { value: "bar_certificate", label: "Bar certificate" },
  { value: "selfie", label: "Selfie" },
];

export function KycForm({ allowResubmit }: { allowResubmit: boolean }) {
  const [docs, setDocs] = useState<Record<DocKind, string>>({
    government_id: "",
    bar_certificate: "",
    selfie: "",
    other: "",
  });
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
    const { uploadUrl, s3Key } = (await res.json()) as { uploadUrl: string; s3Key: string };

    const put = await fetch(uploadUrl, { method: "PUT", body: file });
    if (!put.ok) throw new Error(`upload failed: ${put.status}`);

    setDocs((prev) => ({ ...prev, [kind]: s3Key }));
  }

  async function onFile(kind: DocKind, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await presign(kind, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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
        setResult(`Submitted (${res.submissionId.slice(0, 8)}…). Status: ${res.status}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submit failed");
      }
    });
  }

  if (!allowResubmit) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Submission is in review. You&apos;ll be able to resubmit if it&apos;s rejected.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      {KINDS.map((k) => (
        <div key={k.value} className="space-y-1.5">
          <Label htmlFor={`file-${k.value}`}>{k.label}</Label>
          <input
            id={`file-${k.value}`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onFile(k.value, e)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
          />
          {docs[k.value] && (
            <p className="text-xs text-emerald-700">Uploaded: {docs[k.value].split("/").pop()}</p>
          )}
        </div>
      ))}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && <p className="text-sm text-emerald-700">{result}</p>}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Submitting..." : "Submit for verification"}
      </Button>
    </form>
  );
}

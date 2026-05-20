"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitKyc } from "@/lib/actions/lawyer";
import type { KycSubmissionInput } from "@ligala/shared/schemas";

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
      <p className="mt-6 text-sm text-neutral-500">
        Submission is in review. You&apos;ll be able to resubmit if it&apos;s rejected.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      {KINDS.map((k) => (
        <label key={k.value} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{k.label}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onFile(k.value, e)}
            className="text-sm"
          />
          {docs[k.value] && (
            <span className="text-xs text-emerald-700">Uploaded: {docs[k.value].split("/").pop()}</span>
          )}
        </label>
      ))}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && <p className="text-sm text-emerald-700">{result}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit for verification"}
      </button>
    </form>
  );
}

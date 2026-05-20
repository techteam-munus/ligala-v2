import { api } from "@/lib/api";
import { KycForm } from "./form";

type KycResponse = {
  submission: {
    id: string;
    status: string;
    rejectReason: string | null;
    submittedAt: string | null;
    decidedAt: string | null;
  } | null;
  documents: { kind: string; s3Key: string }[];
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function KycPage() {
  const kyc = await safe<KycResponse>("/lawyers/kyc", { submission: null, documents: [] });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">KYC verification</h1>
      <p className="mt-2 text-neutral-600">
        Upload a government ID, your bar certificate, and a selfie. We submit them to
        IDMeta for verification; you&apos;ll see status updates here.
      </p>

      {kyc.submission && (
        <div className="mt-6 rounded border border-neutral-200 p-4">
          <p className="text-sm">
            Current status: <strong>{kyc.submission.status}</strong>
            {kyc.submission.submittedAt &&
              ` (submitted ${new Date(kyc.submission.submittedAt).toLocaleString()})`}
          </p>
          {kyc.submission.rejectReason && (
            <p className="mt-2 text-sm text-red-700">
              Reason: {kyc.submission.rejectReason}
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            {kyc.documents.length} document{kyc.documents.length === 1 ? "" : "s"} on file.
          </p>
        </div>
      )}

      <KycForm allowResubmit={kyc.submission?.status !== "submitted"} />
    </main>
  );
}

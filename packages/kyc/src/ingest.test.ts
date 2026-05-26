import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- S3 mock ---------------------------------------------------------------
const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: s3Send })),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

// --- IDMeta client mock (finalize backstop not needed; images come from arg) ---
vi.mock("./idmeta", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./idmeta")>();
  return {
    ...actual,
    finalizeVerification: vi.fn(async () => ({ status: 3, status_message: "VERIFIED" })),
    fetchDocumentBytes: vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    })),
  };
});

// --- DB mock ---------------------------------------------------------------
const docInserts: unknown[] = [];
const submissionUpdates: unknown[] = [];
let submission: { id: string; lawyerId: string; idmetaApplicantId: string | null; submittedAt?: Date | null } | null;
let existingDocs: { kind: string }[];

vi.mock("@ligala/db", () => {
  const insertValues = vi.fn(async (rows: unknown) => {
    docInserts.push(rows);
  });
  return {
    db: () => ({
      query: {
        kycSubmissions: { findFirst: vi.fn(async () => submission) },
        kycDocuments: { findMany: vi.fn(async () => existingDocs) },
      },
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: (v: unknown) => ({ where: vi.fn(async () => { submissionUpdates.push(v); }) }) })),
      select: vi.fn(),
    }),
    schema: {
      kycSubmissions: { idmetaApplicantId: "idmeta_applicant_id", id: "id" },
      kycDocuments: { submissionId: "submission_id" },
    },
  };
});

import { ingestIdmetaResult } from "./ingest";

const webhookResults = {
  document_verification: {
    request_data: { imageFrontSide: "data:image/jpeg;base64,/9j/AAAA" },
  },
  biometric_verification: { request_result: { face_url: "https://x/face.jpg" } },
};

beforeEach(() => {
  docInserts.length = 0;
  submissionUpdates.length = 0;
  s3Send.mockReset().mockResolvedValue({});
  submission = { id: "sub_1", lawyerId: "usr_1", idmetaApplicantId: "ver_1" };
  existingDocs = [];
  process.env.S3_UPLOADS_BUCKET = "test-bucket";
});
afterEach(() => {
  delete process.env.S3_UPLOADS_BUCKET;
  vi.clearAllMocks();
});

describe("ingestIdmetaResult", () => {
  it("uploads each captured image to S3 and inserts kyc_document rows, updating status", async () => {
    const res = await ingestIdmetaResult({
      verificationId: "ver_1",
      status: "VERIFIED",
      verificationResults: webhookResults,
    });
    expect(res.ingestedDocuments).toBe(2); // front ID + face selfie
    expect(s3Send).toHaveBeenCalledTimes(2);
    // both kinds present
    const rows = docInserts.flat() as { kind: string; s3Key: string }[];
    const kinds = rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(["government_id", "selfie"]);
    expect(rows.every((r) => r.s3Key.startsWith("kyc_document/usr_1/"))).toBe(true);
    expect(submissionUpdates[0]).toMatchObject({ status: "approved" });
  });

  it("is idempotent: re-running with documents already present uploads nothing new", async () => {
    existingDocs = [{ kind: "government_id" }, { kind: "selfie" }];
    const res = await ingestIdmetaResult({
      verificationId: "ver_1",
      status: "VERIFIED",
      verificationResults: webhookResults,
    });
    expect(res.ingestedDocuments).toBe(0);
    expect(s3Send).not.toHaveBeenCalled();
    // status is still reconciled
    expect(submissionUpdates[0]).toMatchObject({ status: "approved" });
  });

  it("returns notFound when no submission maps to the verification id", async () => {
    submission = null;
    const res = await ingestIdmetaResult({ verificationId: "ver_x" });
    expect(res.notFound).toBe(true);
    expect(s3Send).not.toHaveBeenCalled();
  });
});

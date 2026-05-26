import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return s3;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Upload an ingested KYC document to the uploads bucket under the per-lawyer
 * prefix the rest of the app already expects (kyc_document/<lawyerId>/...).
 * Returns the S3 key, or null when no bucket is configured (dev) — the caller
 * skips the DB row in that case.
 */
export async function putKycDocument(
  lawyerId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const bucket = process.env.S3_UPLOADS_BUCKET;
  if (!bucket) {
    console.warn("[kyc] S3_UPLOADS_BUCKET unset; skipping ingest upload for", lawyerId);
    return null;
  }
  const ext = EXT_BY_TYPE[contentType.toLowerCase()] ?? "bin";
  const key = `kyc_document/${lawyerId}/${crypto.randomUUID()}.${ext}`;
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      Metadata: { kind: "kyc_document", "user-id": lawyerId, source: "idmeta" },
    }),
  );
  return key;
}

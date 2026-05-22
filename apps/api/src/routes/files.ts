import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { presignRequest, type PresignResponse } from "@ligala/shared/schemas";
import { requireSession } from "../middleware/session";

const PRESIGN_TTL_SECONDS = 15 * 60;

// Module-scoped client so the SDK reuses connections across warm Lambda
// invocations. Created lazily because the dev path doesn't need it and tests
// can run without AWS creds.
let s3: S3Client | null = null;
function s3Client(): S3Client {
  s3 ??= new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return s3;
}

export const files = new Hono()
  .use("*", requireSession)
  .post("/presign", zValidator("json", presignRequest), async (c) => {
    const { kind, contentType } = c.req.valid("json");
    const user = c.get("user");
    const ext = contentType.split("/")[1] ?? "bin";
    const s3Key = `${kind}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const bucket = process.env.S3_UPLOADS_BUCKET;

    // Dev fallback: when no bucket is configured the client PUTs to the local
    // dev sink below so the lawyer onboarding form completes its happy path.
    if (!bucket) {
      const apiUrl = process.env.API_URL ?? "http://localhost:8787";
      const body: PresignResponse = {
        s3Key,
        uploadUrl: `${apiUrl}/files/_dev/upload?key=${encodeURIComponent(s3Key)}`,
        kind,
        expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString(),
      };
      return c.json(body);
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: contentType,
      // Tagged metadata makes admin tooling and S3 lifecycle policies easier
      // to write later without re-deriving the kind from the key prefix.
      Metadata: { kind, "user-id": user.id },
    });
    const uploadUrl = await getSignedUrl(s3Client(), command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
    const body: PresignResponse = {
      s3Key,
      uploadUrl,
      kind,
      expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString(),
    };
    return c.json(body);
  })
  .put("/_dev/upload", (c) => {
    return c.json({ ok: true, key: c.req.query("key") ?? null });
  });

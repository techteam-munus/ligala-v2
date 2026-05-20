import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { presignRequest, type PresignResponse } from "@ligala/shared/schemas";
import { requireSession } from "../middleware/session";

/**
 * Stub implementation. Real S3 presigning lands when CDK provisions the
 * uploads bucket and we add @aws-sdk/s3-request-presigner here. The dev
 * upload endpoint at `/files/_dev/upload` accepts the PUT and discards it
 * so the lawyer onboarding form can complete its happy path locally.
 */
export const files = new Hono()
  .use("*", requireSession)
  .post("/presign", zValidator("json", presignRequest), (c) => {
    const { kind, contentType } = c.req.valid("json");
    const user = c.get("user");
    const ext = contentType.split("/")[1] ?? "bin";
    const s3Key = `${kind}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const apiUrl = process.env.API_URL ?? "http://localhost:8787";
    const body: PresignResponse = {
      s3Key,
      uploadUrl: `${apiUrl}/files/_dev/upload?key=${encodeURIComponent(s3Key)}`,
      kind,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    return c.json(body);
  })
  .put("/_dev/upload", (c) => {
    // Dev-only sink. In prod the PUT goes straight to S3 via the presigned URL.
    return c.json({ ok: true, key: c.req.query("key") ?? null });
  });

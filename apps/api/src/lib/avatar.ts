import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Avatars aren't sensitive (lawyer photos are shown publicly), so a longer TTL
// than KYC docs/attachments is fine — fewer re-signs on long-open tabs.
const AVATAR_VIEW_TTL_SECONDS = 60 * 60;

// Module-scoped client so the SDK reuses connections across warm Lambda
// invocations. Lazy because the dev path and tests don't need AWS creds.
let s3: S3Client | null = null;
function s3Client(): S3Client {
  s3 ??= new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return s3;
}

/**
 * Turn a stored `user.image` value into a URL the browser can render.
 *
 *   null / ""            -> null
 *   external http(s) URL -> passthrough (e.g. Google OAuth avatars)
 *   an `avatar/` S3 key   -> short-lived presigned GET (the bucket is private)
 *   anything else        -> null
 *
 * The `avatar/`-prefix gate is deliberate defense-in-depth: even if some other
 * key ever slipped into `user.image`, this never becomes a presign oracle that
 * mints read URLs for arbitrary bucket objects. The write path
 * (PATCH /accounts/avatar) enforces a per-user prefix on top of this.
 */
export async function resolveImageUrl(
  image: string | null | undefined,
): Promise<string | null> {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (!image.startsWith("avatar/")) return null;

  const bucket = process.env.S3_UPLOADS_BUCKET;
  if (!bucket) {
    // Dev fallback: no real bucket, so point at the dev sink. The bytes won't
    // actually be served (the sink returns JSON), but the UI flow completes
    // locally — same limitation as KYC docs / case attachments in dev.
    const apiUrl = process.env.API_URL ?? "http://localhost:8787";
    return `${apiUrl}/files/_dev/upload?key=${encodeURIComponent(image)}`;
  }

  const command = new GetObjectCommand({ Bucket: bucket, Key: image });
  return getSignedUrl(s3Client(), command, {
    expiresIn: AVATAR_VIEW_TTL_SECONDS,
  });
}

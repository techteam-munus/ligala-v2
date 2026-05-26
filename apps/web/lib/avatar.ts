import { api } from "@/lib/api";

/**
 * Resolve a stored `user.image` value to a URL the sidebar can render in SSR.
 *
 * The api stores an uploaded photo as an S3 key (private bucket), which needs a
 * presigned GET to display. External (OAuth) URLs and the no-photo case need no
 * api call, so we short-circuit them here and only round-trip to the api for an
 * uploaded key. The api endpoint reads the key from the session itself, so we
 * never pass a client-supplied key.
 */
export async function resolveAvatarUrl(
  image: string | null | undefined,
): Promise<string | null> {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  try {
    const { url } = await api<{ url: string | null }>("/accounts/avatar-url");
    return url;
  } catch {
    return null;
  }
}

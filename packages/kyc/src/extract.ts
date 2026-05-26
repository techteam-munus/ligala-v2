export type ExtractedImageKind = "selfie" | "government_id";
export interface ExtractedImage {
  kind: ExtractedImageKind;
  /** Either an http(s) URL or a `data:image/...;base64,...` string. */
  ref: string;
}

// Key-name hints → document kind. Checked as a lowercased substring of the key.
const SELFIE_HINTS = ["face", "selfie", "photo", "liveness", "portrait"];
const DOCUMENT_HINTS = ["front", "back", "document", "doc", "id", "passport", "license"];

function isImageRef(value: string): boolean {
  if (value.startsWith("data:image/")) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  // URL without an obvious non-image extension is still accepted (IDMeta S3
  // URLs often omit extensions); only reject clearly non-image doc types.
  return !/\.(pdf|json|xml|txt|csv)(\?|$)/i.test(value);
}

function classify(key: string): ExtractedImageKind | null {
  const k = key.toLowerCase();
  if (SELFIE_HINTS.some((h) => k.includes(h))) return "selfie";
  if (DOCUMENT_HINTS.some((h) => k.includes(h))) return "government_id";
  return null;
}

/**
 * Recursively scan an arbitrary IDMeta result object for captured images.
 * IDMeta nests images under per-check keys (e.g.
 * verification_results.document_verification.request_data.imageFrontSide) and
 * the exact path varies by template, so we walk the whole tree and classify by
 * the key the image string sits under. Deduped by ref.
 */
export function extractImages(source: unknown): ExtractedImage[] {
  const out: ExtractedImage[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, key: string): void => {
    if (node == null) return;
    if (typeof node === "string") {
      if (!isImageRef(node) || seen.has(node)) return;
      const kind = classify(key);
      if (!kind) return;
      seen.add(node);
      out.push({ kind, ref: node });
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key);
      return;
    }
    if (typeof node === "object") {
      for (const [childKey, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, childKey);
      }
    }
  };

  walk(source, "");
  return out;
}

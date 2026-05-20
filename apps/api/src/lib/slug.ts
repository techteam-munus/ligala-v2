/**
 * Slug helper — used to derive a lawyer's public URL segment from their name.
 * Always returns a value the lawyer can override later via PATCH.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || "lawyer";
}

/**
 * Append a short random suffix to ensure uniqueness when the bare slug is taken.
 */
export function withRandomSuffix(slug: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug}-${suffix}`.slice(0, 60);
}

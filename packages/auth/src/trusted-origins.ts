/**
 * Extra origins allowed to make state-changing auth requests (sign-in,
 * sign-out, …). Better Auth's CSRF protection rejects any such POST whose
 * `Origin` isn't trusted, and the default trusted set is ONLY `baseURL`. When
 * the app is reached from more than one host — e.g. a custom domain
 * (`https://dev.ligalaoffice.mymunus.com`) in front of the Amplify default
 * domain — every additional host MUST be listed here, or sign-out from it 403s
 * and the session cookie never clears (the user appears stuck logged in).
 *
 * Comma-separated in `AUTH_TRUSTED_ORIGINS`; `baseURL` stays implicitly trusted.
 */
export function parseTrustedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

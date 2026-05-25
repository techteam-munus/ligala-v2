// RFC 2606 / 6761 reserve these TLDs for testing, documentation, and the local
// host. Mail to them can never be delivered, so attempting a real send only
// produces SES bounces (which count against sender reputation). The e2e suite
// signs users up with `@*.test` addresses, so without this gate every test run
// fires bouncing sends. Recipients here are recorded `suppressed` and never
// handed to SES.
const RESERVED_TLDS = new Set(["test", "example", "invalid", "localhost"]);

/**
 * True when `email`'s domain uses a reserved, non-deliverable TLD — e.g. the
 * `@*.test` addresses the Playwright suite signs up with. Case-insensitive and
 * tolerant of a trailing dot (FQDN form). Malformed input returns false (let
 * the normal path / SES reject it).
 */
export function isUndeliverableRecipient(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email
    .slice(at + 1)
    .toLowerCase()
    .replace(/\.$/, "");
  if (domain.length === 0) return false;
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  return RESERVED_TLDS.has(tld);
}

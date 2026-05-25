import { createHash } from "node:crypto";
import type { EmailMessage } from "@ligala/shared/schemas";

function tokenHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}
type U = { id: string; email: string; name?: string | null };

export function buildVerificationMessage(user: U, url: string): Extract<EmailMessage, { kind: "auth_verify" }> {
  return { kind: "auth_verify", to: user.email, dedupeKey: `auth_verify:${user.id}:${tokenHash(url)}`, data: { name: user.name ?? "there", verifyUrl: url } };
}
export function buildResetMessage(user: U, url: string): Extract<EmailMessage, { kind: "auth_reset" }> {
  return { kind: "auth_reset", to: user.email, dedupeKey: `auth_reset:${user.id}:${tokenHash(url)}`, data: { name: user.name ?? "there", resetUrl: url } };
}

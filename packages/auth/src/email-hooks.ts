import { createHash } from "node:crypto";
import type { EmailMessage } from "@ligala/shared/schemas";

function tokenHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}
type U = { id: string; email: string; name?: string | null };

// Email verification is now a 6-digit code (Better Auth emailOTP plugin) rather
// than a magic link. The OTP callback only hands us `{ email, otp }` — no user
// id/name — so we key the dedupe on email + a hash of the code (each rotated
// code is distinct, so a resend produces a new key and is not suppressed).
export function buildVerificationCodeMessage(email: string, code: string): Extract<EmailMessage, { kind: "auth_verify" }> {
  return { kind: "auth_verify", to: email, dedupeKey: `auth_verify:${email}:${tokenHash(code)}`, data: { code } };
}
export function buildResetMessage(user: U, url: string): Extract<EmailMessage, { kind: "auth_reset" }> {
  return { kind: "auth_reset", to: user.email, dedupeKey: `auth_reset:${user.id}:${tokenHash(url)}`, data: { name: user.name ?? "there", resetUrl: url } };
}

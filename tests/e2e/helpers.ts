import { expect, type Page } from "@playwright/test";

export const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8787";

const DASHBOARD = /\/dashboard|\/lawyer\/dashboard|\/admin\/dashboard/;

export function uniqueEmail(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}+${stamp}${rand}@ligala.test`;
}

/**
 * Mark an address verified via the dev-only, session-less verify route. Needed
 * under hard email verification (EMAIL_VERIFICATION_REQUIRED), where sign-up
 * creates no session and sign-in is blocked until the email is confirmed.
 *
 * The route returns two distinct 404s:
 *  - `{message:"not_found"}`     → route disabled (verification OFF) → no-op.
 *  - `{message:"user_not_found"}` → the user row isn't visible yet (sign-up
 *    just committed; RDS Proxy read lag) → retry briefly.
 */
export async function verifyEmail(page: Page, email: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await page.request.post(`${API_URL}/accounts/_dev/verify-email`, {
      data: { email },
    });
    if (res.status() === 200) return;
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status() === 404 && body.message === "not_found") return;
    if (res.status() === 404 && body.message === "user_not_found") {
      await page.waitForTimeout(500);
      continue;
    }
    throw new Error(`dev verify-email failed: ${res.status()} ${JSON.stringify(body)}`);
  }
  throw new Error(`dev verify-email: user ${email} not found after retries`);
}

export async function signUp(
  page: Page,
  opts: { name: string; email: string; password: string },
) {
  await page.goto("/signup");
  await page.getByLabel(/name/i).fill(opts.name);
  await page.getByLabel(/email/i).fill(opts.email);
  await page.locator("#password").fill(opts.password);
  await page.locator("#confirm-password").fill(opts.password);

  // Wait for the sign-up request to complete so the user row exists before we
  // verify it — otherwise verifyEmail can race ahead of user creation.
  const signedUp = page.waitForResponse(
    (r) => r.url().includes("/auth/sign-up") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /create account|sign up/i }).click();
  await signedUp;

  // Confirm the address so the account is usable under hard verification, then
  // ensure we end up signed in. This works in both modes:
  //  - verification ON  → sign-up made no session; verify + sign in.
  //  - verification OFF → sign-up auto-signed in; /login redirects to the
  //    dashboard and the early return below skips the (absent) login form.
  await verifyEmail(page, opts.email);
  await page.goto("/login");
  if (DASHBOARD.test(page.url())) return;

  await page.getByLabel(/email/i).fill(opts.email);
  await page.locator("#password").fill(opts.password);
  // Wait for the sign-in response so its Set-Cookie (the session token) is
  // committed before we move on — otherwise the client-side router.push lands
  // the URL on /dashboard before the cookie is durably stored, and a later
  // hard navigation back to /login won't see the session.
  const signedIn = page.waitForResponse(
    (r) => r.url().includes("/auth/sign-in") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.locator('button[type="submit"]').click();
  await signedIn;
  // 30s covers the cold-compile case in `next dev` — Better Auth + Sentry +
  // OpenTelemetry can take 10-13s for the first auth POST, then another few
  // seconds for the /dashboard render.
  await expect(page).toHaveURL(DASHBOARD, { timeout: 30_000 });
}

export async function signIn(
  page: Page,
  opts: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(opts.email);
  await page.locator("#password").fill(opts.password);
  await page.locator('button[type="submit"]').click();
}

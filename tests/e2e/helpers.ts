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
 * Tolerates 404: when the target env runs with verification OFF the route is
 * disabled (EMAIL_DEV_VERIFY_ENABLED unset) and the user is already usable, so
 * a no-op is correct. Any other status is a real failure.
 */
export async function verifyEmail(page: Page, email: string) {
  const res = await page.request.post(`${API_URL}/accounts/_dev/verify-email`, {
    data: { email },
  });
  expect(
    [200, 404].includes(res.status()),
    `dev verify-email returned ${res.status()}`,
  ).toBe(true);
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
  await page.getByRole("button", { name: /create account|sign up/i }).click();

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
  await page.getByRole("button", { name: /sign in|log in/i }).click();
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
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}

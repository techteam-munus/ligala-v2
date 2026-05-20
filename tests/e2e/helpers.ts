import { expect, type Page } from "@playwright/test";

export const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8787";

export function uniqueEmail(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}+${stamp}${rand}@ligala.test`;
}

export async function signUp(
  page: Page,
  opts: { name: string; email: string; password: string },
) {
  await page.goto("/signup");
  await page.getByLabel(/name/i).fill(opts.name);
  await page.getByLabel(/email/i).fill(opts.email);
  await page.getByLabel(/password/i).fill(opts.password);
  await page.getByRole("button", { name: /create account|sign up/i }).click();
  // 30s covers the cold-compile case in `next dev` — Better Auth + Sentry +
  // OpenTelemetry can take 10-13s for the first sign-up POST, then another
  // few seconds for the /dashboard render.
  await expect(page).toHaveURL(/\/dashboard|\/lawyer\/dashboard|\/admin\/dashboard/, {
    timeout: 30_000,
  });
}

export async function signIn(
  page: Page,
  opts: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(opts.email);
  await page.getByLabel(/password/i).fill(opts.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}

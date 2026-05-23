import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

/**
 * Client → lawyer promotion golden path: signup → /become-a-lawyer → click
 * promote → role middleware now routes the user into the lawyer portal.
 *
 * Skipped since Session 12 — `/become-a-lawyer` now requires IBP roll-number
 * verification via IDMeta before the "Continue as a lawyer" button is even
 * rendered. A hermetic spec needs either a seeded unclaimed IBP record + the
 * full multi-step verify form walkthrough, or a test-only promote-without-IBP
 * hook. PROCESS.md (Session 12 — Open questions) tracks this.
 */
test.skip("client can promote to lawyer and reach the lawyer portal", async ({ page }) => {
  const email = uniqueEmail("lawyer");
  await signUp(page, { name: "Atty Promote Tester", email, password: "Test1234!" });

  await page.goto("/become-a-lawyer");
  await page.getByRole("button", { name: /continue as a lawyer/i }).click();

  await expect(page).toHaveURL(/\/lawyer\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Visiting /dashboard (client home) should bounce us back to the lawyer
  // portal — proves the role guard recognized the promotion.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/lawyer\/dashboard/, { timeout: 10_000 });
});

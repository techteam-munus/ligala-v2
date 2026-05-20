import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

/**
 * Client → lawyer promotion golden path: signup → /become-a-lawyer → click
 * promote → role middleware now routes the user into the lawyer portal.
 *
 * The deeper KYC + IDMeta webhook + directory-visibility chain is exercised
 * end-to-end by the Phase 2 curl smoke (23 checks) and the Phase 3 curl smoke
 * (17 checks); replicating it through the browser fixture would require
 * sharing the Better Auth session cookie with Playwright's APIRequestContext
 * — a lift that earns its keep only if the UI itself starts driving each step
 * (today every step is one form per page, already covered by the curl chain).
 */
test("client can promote to lawyer and reach the lawyer portal", async ({ page }) => {
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

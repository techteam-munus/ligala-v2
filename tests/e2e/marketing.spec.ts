import { test, expect } from "@playwright/test";

test.describe("marketing pages", () => {
  test("landing page renders hero + CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /lawyer|engagement|philippine/i,
    );
    await expect(page.getByRole("link", { name: /find a lawyer/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /join as a lawyer/i }).first()).toBeVisible();
  });

  for (const path of ["/about", "/pricing", "/terms", "/privacy"] as const) {
    test(`${path} renders prose content`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("/lawyers directory is reachable from nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /find a lawyer/i }).first().click();
    await expect(page).toHaveURL(/\/lawyers/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

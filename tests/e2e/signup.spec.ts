import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test("client can sign up and land on dashboard", async ({ page }) => {
  await signUp(page, {
    name: "Client Tester",
    email: uniqueEmail("client"),
    password: "Test1234!",
  });
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/client · dashboard/i)).toBeVisible();
});

test("signed-in user visiting /login is redirected to /dashboard", async ({ page }) => {
  await signUp(page, {
    name: "Redirect Tester",
    email: uniqueEmail("redirect"),
    password: "Test1234!",
  });
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
});

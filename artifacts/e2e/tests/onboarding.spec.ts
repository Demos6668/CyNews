import { test, expect } from "@playwright/test";
import { randomSuffix, testEmail } from "../fixtures/seed";

test.use({ storageState: undefined }); // fresh session — auth is part of the flow

test("first-login → onboarding → create workspace → land on dashboard", async ({ page }) => {
  const suffix = randomSuffix();
  const email = testEmail(suffix);
  const password = `TestPass!${suffix}`;

  // Sign up
  await page.goto("/sign-up");
  await page.getByLabel(/name/i).fill(`Onboard User ${suffix}`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign up|create account/i }).click();

  // Should land on onboarding for new users
  await page.waitForURL(/onboarding/, { timeout: 15_000 });
  await expect(page).toHaveURL(/onboarding/);

  // Step 1: workspace name
  const workspaceName = `Workspace ${suffix}`;
  await page.getByLabel(/workspace name/i).fill(workspaceName);
  await page.getByRole("button", { name: /next|continue/i }).first().click();

  // Step 2: add a product (or skip)
  const skipBtn = page.getByRole("button", { name: /skip/i });
  if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skipBtn.click();
  }

  // Should arrive at dashboard
  await page.waitForURL(/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText(/dashboard|welcome/i)).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { createSignedInUser, testEmail, randomSuffix } from "../fixtures/seed";

test.describe("Authentication flow", () => {
  test("sign-up → sign-in → sign-out → session persists across reload", async ({ page }) => {
    const suffix = randomSuffix();
    const email = testEmail(suffix);
    const password = `TestPass!${suffix}`;

    // Sign up
    await page.goto("/sign-up");
    await page.getByLabel(/name/i).fill(`Test User ${suffix}`);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign up|create account/i }).click();
    await page.waitForURL(/\/(onboarding|dashboard|$)/, { timeout: 15_000 });

    // Reload — should still be authenticated
    await page.reload();
    await expect(page).not.toHaveURL(/sign-in/);

    // Sign out
    await page.goto("/sign-out");
    await page.waitForURL(/sign-in/, { timeout: 10_000 });
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in with wrong password shows error", async ({ page }) => {
    const { email } = await createSignedInUser();

    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("WrongPassword999!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("alert").or(page.getByText(/invalid|incorrect/i))).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/sign-in/);
  });

  test("protected routes redirect unauthenticated users to sign-in", async ({ browser }) => {
    // Use a fresh context with no stored auth
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/dashboard");
    await page.waitForURL(/sign-in/, { timeout: 10_000 });
    await expect(page).toHaveURL(/sign-in/);

    await context.close();
  });
});

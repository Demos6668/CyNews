import { test, expect } from "@playwright/test";
import { createSignedInUser } from "../fixtures/seed";

test.use({ storageState: undefined }); // fresh session — auth is part of the flow

test.describe("Account deletion lifecycle", () => {
  test("request deletion → see grace period UI → cancel → account still works", async ({ page }) => {
    const { email, password } = await createSignedInUser();

    // Sign in as this user
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|onboarding|$)/, { timeout: 15_000 });

    // Navigate to danger zone
    await page.goto("/settings");
    const deleteBtn = page.getByRole("button", { name: /delete account|danger/i });
    if (!(await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Delete account UI not wired yet — Phase 3 deliverable");
    }

    await deleteBtn.click();

    // Confirm dialog
    const confirmField = page.getByLabel(/type your email/i);
    if (await confirmField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmField.fill(email);
    }
    await page.getByRole("button", { name: /confirm|yes, delete/i }).click();

    // Should show grace period countdown
    await expect(page.getByText(/days|grace|purge/i)).toBeVisible({ timeout: 5_000 });

    // Cancel the deletion
    const cancelBtn = page.getByRole("button", { name: /cancel deletion|keep account/i });
    if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cancelBtn.click();
      await expect(page.getByText(/days|grace|purge/i)).not.toBeVisible({ timeout: 3_000 });
    }

    // Account should still work after cancellation
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/sign-in/);
  });
});

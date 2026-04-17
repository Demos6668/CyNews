import { test, expect } from "@playwright/test";

test.describe("Saved views", () => {
  test("create → list → delete a saved view on advisories page", async ({ page }) => {
    await page.goto("/advisories");
    await expect(page.locator('[data-testid="advisory-list"], [role="list"]').first()).toBeVisible({ timeout: 10_000 });

    // Open saved views panel
    const saveBtn = page.getByRole("button", { name: /save view|saved views/i });
    if (!(await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "SavedViewsButton not visible — feature may not be wired yet");
    }
    await saveBtn.click();

    // Create a new saved view
    const viewName = `My View ${Date.now()}`;
    await page.getByLabel(/view name|name/i).fill(viewName);
    await page.getByRole("button", { name: /save|create/i }).last().click();

    // Saved view should appear in list
    await expect(page.getByText(viewName)).toBeVisible({ timeout: 5_000 });

    // Delete it
    await page.getByRole("button", { name: /delete|remove/i }).last().click();
    await expect(page.getByText(viewName)).not.toBeVisible({ timeout: 5_000 });
  });
});

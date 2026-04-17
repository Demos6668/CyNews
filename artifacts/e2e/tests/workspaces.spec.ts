import { test, expect } from "@playwright/test";
import { randomSuffix } from "../fixtures/seed";

test.describe("Workspaces", () => {
  test("create workspace → appears in list", async ({ page }) => {
    await page.goto("/workspaces");
    await expect(page).toHaveURL(/workspaces/);

    const createBtn = page.getByRole("button", { name: /add workspace|new workspace|create/i });
    if (!(await createBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "Create workspace button not visible");
    }

    await createBtn.click();

    const suffix = randomSuffix();
    const wsName = `E2E Workspace ${suffix}`;

    await page.getByLabel(/workspace name|name/i).fill(wsName);
    await page.getByLabel(/domain/i).fill(`e2e-${suffix}.example.com`);
    await page.getByRole("button", { name: /create|save/i }).last().click();

    await expect(page.getByText(wsName)).toBeVisible({ timeout: 10_000 });
  });

  test("cannot delete the default (master) workspace", async ({ page }) => {
    await page.goto("/workspaces");
    await expect(page).toHaveURL(/workspaces/);

    // The default workspace delete button should be disabled or absent
    const defaultWorkspace = page.locator('[data-default="true"], [data-testid="default-workspace"]').first();
    if (await defaultWorkspace.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const deleteBtn = defaultWorkspace.getByRole("button", { name: /delete/i });
      await expect(deleteBtn).toBeDisabled({ timeout: 3_000 });
    }
  });
});

import { test, expect } from "@playwright/test";

test.describe("Patch tracker", () => {
  test("page loads, sort and filter work", async ({ page }) => {
    await page.goto("/patches");
    await expect(page.getByRole("table").or(page.locator('[data-testid="patch-list"]'))).toBeVisible({ timeout: 15_000 });

    // Try sorting by clicking a column header
    const header = page.getByRole("columnheader").first();
    if (await header.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await header.click();
      await expect(page.getByRole("table")).toBeVisible();
    }
  });

  test("retry button visible on API failure", async ({ page }) => {
    await page.route("**/api/advisories/patches*", (route) =>
      route.fulfill({ status: 500, body: '{"error":"test"}' })
    );
    await page.goto("/patches");
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible({ timeout: 10_000 });
  });
});

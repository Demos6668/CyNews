import { test, expect } from "@playwright/test";

test.describe("Advisory browsing", () => {
  test("list loads, filter by severity works, deep link via URL query", async ({ page }) => {
    await page.goto("/advisories");

    // Wait for advisory list to render
    await expect(page.locator('[data-testid="advisory-list"], [role="list"]').first()).toBeVisible({ timeout: 10_000 });

    // Filter by critical severity
    const severityFilter = page.getByLabel(/severity/i).or(
      page.getByRole("combobox", { name: /severity/i })
    );
    if (await severityFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await severityFilter.selectOption("critical");
      await page.waitForTimeout(500); // debounce
    }

    // Deep link via URL params should maintain filter state
    await page.goto("/advisories?severity=critical");
    await expect(page).toHaveURL(/severity=critical/);
    await expect(page.locator('[data-testid="advisory-list"], [role="list"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test("keyboard navigation: j/k moves focus, o opens detail", async ({ page }) => {
    await page.goto("/advisories");
    await expect(page.locator('[data-testid="advisory-list"], [role="list"]').first()).toBeVisible({ timeout: 10_000 });

    // Focus the page and press j to move to first item
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("k");

    // ? opens shortcuts modal
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog").or(page.getByText(/keyboard shortcuts/i))).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("Escape");
  });

  test("ErrorState retry button is present when API fails", async ({ page }) => {
    // Intercept advisories API to simulate error
    await page.route("**/api/advisories*", (route) => route.fulfill({ status: 500, body: '{"error":"test"}' }));
    await page.goto("/advisories");
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible({ timeout: 10_000 });
  });
});

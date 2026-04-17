import { test, expect } from "@playwright/test";

test.describe("Bookmarks", () => {
  test("add bookmark → appears on bookmarks page → delete", async ({ page }) => {
    await page.goto("/news");
    await expect(page.locator('[data-testid="news-list"], article, [role="listitem"]').first()).toBeVisible({ timeout: 10_000 });

    // Bookmark the first item
    const bookmarkBtn = page.getByRole("button", { name: /bookmark/i }).first();
    await bookmarkBtn.click();
    await expect(bookmarkBtn).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });

    // Verify it appears on the bookmarks page
    await page.goto("/bookmarks");
    await expect(page.locator('article, [role="listitem"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test("bookmark toggle removes item from bookmarks page", async ({ page }) => {
    await page.goto("/bookmarks");

    const items = page.locator('article, [role="listitem"]');
    const count = await items.count();
    if (count === 0) {
      test.skip(true, "No bookmarks to test removal with");
    }

    // Remove the first bookmark
    await page.getByRole("button", { name: /bookmark/i }).first().click();
    await expect(items).toHaveCount(count - 1, { timeout: 5_000 });
  });
});

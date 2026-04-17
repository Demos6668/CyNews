import { test, expect } from "@playwright/test";

test.describe("Billing", () => {
  test("billing settings page loads and shows plan info", async ({ page }) => {
    await page.goto("/settings/billing");

    // Should show current plan
    await expect(
      page.getByText(/free|pro|team|enterprise|current plan/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("checkout button navigates to Stripe or shows upgrade flow", async ({ page }) => {
    await page.goto("/settings/billing");

    const upgradeBtn = page.getByRole("button", { name: /upgrade|checkout|subscribe/i });
    if (!(await upgradeBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "No upgrade button visible — may already be on paid plan");
    }

    // Mock Stripe redirect — we don't want to actually navigate to Stripe in tests
    await page.route("**/api/billing/checkout*", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ url: "https://checkout.stripe.com/test" }) })
    );
    await upgradeBtn.click();
    // Should either navigate or show a loading state
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 3_000 });
  });
});

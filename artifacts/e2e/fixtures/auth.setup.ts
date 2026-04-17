/**
 * Playwright global setup — creates a signed-in session and writes
 * storageState to .auth/user.json so all tests start authenticated.
 *
 * Runs once before all test projects (via the "setup" project dependency).
 */

import { test as setup } from "@playwright/test";
import { createSignedInUser } from "./seed";
import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

const AUTH_FILE = resolve(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  const { email, password } = await createSignedInUser();

  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard — confirms auth succeeded
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15_000 });

  // Persist session cookies so all tests can reuse this identity
  const storageState = await page.context().storageState();
  mkdirSync(resolve(__dirname, "../.auth"), { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(storageState));
});

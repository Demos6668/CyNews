import { defineConfig, devices } from "@playwright/test";
import { resolve } from "path";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["html", { open: "on-failure" }]],

  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Persist auth state written by fixtures/auth.setup.ts
    storageState: resolve(__dirname, ".auth/user.json"),
  },

  projects: [
    // Auth setup — runs once before all tests and writes .auth/user.json
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { storageState: undefined },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
    },
    // WebKit is run nightly only (controlled by the CI matrix)
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      url: `${BACKEND_URL}/api/livez`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        SINGLE_TENANT: "true",
        DATABASE_URL: process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL ?? "",
        BETTER_AUTH_TEST_MODE: "true",
      },
    },
    {
      command: "pnpm --filter @workspace/cyfy-news run dev",
      url: FRONTEND_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: BACKEND_URL,
        VITE_TEST_MODE: "true",
      },
    },
  ],
});

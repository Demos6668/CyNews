import { test, expect } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Rate limit smoke test.
 * Sends 25 rapid sign-in requests to trigger the authLimiter (max: 20/15min).
 * This test is intentionally skipped unless RATE_LIMIT_TESTS=true is set
 * to avoid flaking CI due to rate limit state carrying over between test runs.
 */
test("auth endpoint rate-limits after 20 rapid requests", async ({ request }) => {
  if (!process.env.RATE_LIMIT_TESTS) {
    test.skip(true, "Skipped unless RATE_LIMIT_TESTS=true (affects shared rate-limit buckets)");
  }

  const responses = await Promise.all(
    Array.from({ length: 25 }, () =>
      request.post(`${BACKEND_URL}/api/auth/sign-in/email`, {
        data: { email: "nonexistent@example.com", password: "BadPass123!" },
      })
    )
  );

  const statusCodes = responses.map((r) => r.status());
  expect(statusCodes).toContain(429);
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
      // Route tests exercise handler behaviour, not the auth resolver.
      // SINGLE_TENANT attaches a synthetic owner-level req.ctx so requireAuth
      // and requirePermission short-circuit. Dedicated auth tests
      // (middlewares/auth.test.ts, tenantContext tests) either don't go
      // through the Express app or set this per-test.
      SINGLE_TENANT: "true",
    },
  },
});

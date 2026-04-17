import { test, expect } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

test.describe("Health endpoints", () => {
  test("/api/livez returns alive:true without DB check", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/livez`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.alive).toBe(true);
  });

  test("/api/healthz returns status and pool stats", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/healthz`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body.status).toMatch(/healthy|degraded/);
    expect(body.pool).toBeDefined();
    expect(typeof body.pool.total).toBe("number");
    expect(typeof body.pool.idle).toBe("number");
    expect(typeof body.pool.waiting).toBe("number");
  });

  test("/api/readyz returns checks and pool stats", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/readyz`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.ready).toBe("boolean");
    expect(body.checks).toBeDefined();
    expect(body.pool).toBeDefined();
  });
});

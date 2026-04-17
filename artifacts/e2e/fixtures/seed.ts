/**
 * Test data seeding utilities.
 *
 * Each test gets unique credentials via randomSuffix() to prevent cross-test
 * pollution. The global teardown truncates all tables except drizzle_migrations.
 *
 * BETTER_AUTH_TEST_MODE=true in the server shortcircuits email verification so
 * signUp + signIn work without a real OTP flow.
 */

import { randomUUID } from "crypto";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

export function randomSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function testEmail(suffix = randomSuffix()): string {
  return `test-${suffix}@example.com`;
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export interface TestOrg {
  name: string;
  slug: string;
}

export async function apiPost<T>(path: string, body: unknown, cookie?: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`API ${path} failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, cookie?: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`API GET ${path} failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Sign up a new user via Better Auth and return their session cookie.
 * Relies on BETTER_AUTH_TEST_MODE=true to skip OTP email verification.
 */
export async function createSignedInUser(user?: Partial<TestUser>): Promise<{
  email: string;
  password: string;
  name: string;
  cookie: string;
}> {
  const suffix = randomSuffix();
  const email = user?.email ?? testEmail(suffix);
  const password = user?.password ?? `TestPass!${suffix}`;
  const name = user?.name ?? `Test User ${suffix}`;

  // Sign up
  const signUpRes = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!signUpRes.ok && signUpRes.status !== 409) {
    const text = await signUpRes.text().catch(() => "(no body)");
    throw new Error(`Sign up failed ${signUpRes.status}: ${text}`);
  }

  // Sign in to get session cookie
  const signInRes = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signInRes.ok) {
    const text = await signInRes.text().catch(() => "(no body)");
    throw new Error(`Sign in failed ${signInRes.status}: ${text}`);
  }

  const setCookieHeader = signInRes.headers.get("set-cookie") ?? "";
  // Extract the session token cookie for use in subsequent requests
  const cookie = setCookieHeader.split(";")[0] ?? "";

  return { email, password, name, cookie };
}

/**
 * Better Auth configuration.
 *
 * This module exports the `auth` object (Better Auth instance) and the
 * `authHandler` Express middleware that handles all /api/auth/* requests.
 *
 * Enabled plugins:
 *  - email/password (built-in — no plugin needed)
 *  - magic link (emailOTP plugin, sending via Resend)
 *
 * Social providers and SAML are wired in Phase 3.
 *
 * SINGLE_TENANT mode:
 *   When process.env.SINGLE_TENANT === "true", auth is still active but the
 *   middleware that enforces org membership is skipped (Sub-Phase 4).
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import type { Request, Response } from "express";

import { db } from "@workspace/db";
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "@workspace/db/schema";

import { sendEmail, emailVerifyTemplate, passwordResetTemplate } from "./email";
import { logger } from "./logger";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const secret = process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-min-32-chars!!";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)
) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters in production");
}

export const auth = betterAuth({
  secret,
  baseURL: process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 8080}`,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user:         usersTable,
      session:      sessionsTable,
      account:      accountsTable,
      verification: verificationsTable,
    },
  }),

  // ── Email + Password ──────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string; name: string };
      url: string;
      token: string;
    }) => {
      logger.debug({ email: user.email }, "Sending verification email");
      await sendEmail({
        to: user.email,
        ...emailVerifyTemplate({ name: user.name, verifyUrl: url }),
      });
    },

    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string; name: string };
      url: string;
      token: string;
    }) => {
      logger.debug({ email: user.email }, "Sending password reset email");
      await sendEmail({
        to: user.email,
        ...passwordResetTemplate({ name: user.name, resetUrl: url }),
      });
    },
  },

  // ── Email OTP (magic link) ────────────────────────────────────────────────
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === "sign-in"
            ? "Your CyNews sign-in code"
            : "Your CyNews verification code";
        await sendEmail({
          to: email,
          subject,
          text: `Your code is: ${otp}\n\nThis code expires in 10 minutes.`,
          html: `<p>Your CyNews code is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>This code expires in 10 minutes.</p>`,
        });
      },
      expiresIn: 600, // 10 minutes
    }),
  ],

  // ── Session config ────────────────────────────────────────────────────────
  session: {
    expiresIn: 7 * 24 * 60 * 60,    // 7 days
    updateAge: 24 * 60 * 60,         // refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,                // 5-minute client cache
    },
  },

  // ── Trusted origins (for CSRF protection) ────────────────────────────────
  trustedOrigins: [
    frontendUrl,
    ...(process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
      : []),
  ],

  // ── User fields ───────────────────────────────────────────────────────────
  user: {
    additionalFields: {
      // No additional user fields in Phase 1.
      // orgId is tracked via the memberships table, not on the user row.
    },
  },
});

export type Auth = typeof auth;

// ---------------------------------------------------------------------------
// Express adapter
// ---------------------------------------------------------------------------

/**
 * Express request handler that delegates all /api/auth/* requests to
 * Better Auth's built-in handler.
 *
 * Mount it BEFORE the tenant context middleware so that sign-in/sign-up
 * routes are publicly accessible.
 *
 * Usage in app.ts:
 *   app.all("/api/auth/*", authHandler);
 */
export async function authHandler(req: Request, res: Response): Promise<void> {
  // Better Auth expects a Web API Request. Build one from the Express request.
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      const v = Array.isArray(value) ? value.join(", ") : value;
      headers.set(key, v);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? JSON.stringify(req.body) : undefined;

  const webReq = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  try {
    const webRes = await auth.handler(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((value, key) => res.setHeader(key, value));

    const buffer = await webRes.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (err) {
    logger.error({ err, path: req.path }, "Better Auth handler error");
    res.status(500).json({ error: "Authentication service error" });
  }
}

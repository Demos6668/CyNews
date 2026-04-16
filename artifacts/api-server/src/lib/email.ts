/**
 * Resend email wrapper.
 *
 * All transactional email (verify email, password reset, org invites) goes
 * through `sendEmail()`. The Resend client is lazily initialised so startup
 * doesn't fail when RESEND_API_KEY isn't set in dev.
 *
 * In development / on-prem without a key, emails are logged to the console
 * instead of delivered — no stub service required.
 */

import { Resend } from "resend";
import { logger } from "./logger";

const DEFAULT_FROM = "CyNews <no-reply@cynews.io>";

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  _client = new Resend(apiKey);
  return _client;
}

export interface SendEmailOptions {
  /** Recipient address(es). */
  to: string | string[];
  subject: string;
  /** Full HTML body. */
  html: string;
  /** Plain-text fallback (recommended for deliverability). */
  text?: string;
  /** Override the sender address. Defaults to DEFAULT_FROM. */
  from?: string;
  /** Optional reply-to address. */
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
}

/**
 * Send a transactional email via Resend.
 *
 * Falls back to console logging when RESEND_API_KEY is not configured so
 * local dev and on-prem installs can work without email credentials.
 *
 * @throws {Error} if Resend returns an error.
 */
export async function sendEmail(
  opts: SendEmailOptions
): Promise<SendEmailResult> {
  const client = getClient();
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  const from = opts.from ?? process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!client) {
    // Dev / on-prem fallback — log the email to console
    logger.info(
      {
        email: {
          to,
          from,
          subject: opts.subject,
          preview: opts.text?.slice(0, 200) ?? opts.html.slice(0, 200),
        },
      },
      "Email not sent (RESEND_API_KEY unset) — logged instead"
    );
    return { id: `dev-${Date.now()}` };
  }

  const { data, error } = await client.emails.send({
    from,
    to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
  });

  if (error) {
    logger.error({ err: error, to, subject: opts.subject }, "Resend delivery error");
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  logger.debug({ emailId: data?.id, to, subject: opts.subject }, "Email sent");
  return { id: data!.id };
}

// ---------------------------------------------------------------------------
// Pre-built template helpers (expanded in Sub-Phase 3 for auth emails)
// ---------------------------------------------------------------------------

export function emailVerifyTemplate(opts: {
  name: string;
  verifyUrl: string;
}): Pick<SendEmailOptions, "subject" | "html" | "text"> {
  return {
    subject: "Verify your CyNews email address",
    text: `Hi ${opts.name},\n\nVerify your email: ${opts.verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
<p>Hi ${opts.name},</p>
<p>Click the button below to verify your email address and activate your CyNews account.</p>
<p><a href="${opts.verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Verify Email</a></p>
<p>Or copy this link: ${opts.verifyUrl}</p>
<p>This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>`,
  };
}

export function passwordResetTemplate(opts: {
  name: string;
  resetUrl: string;
}): Pick<SendEmailOptions, "subject" | "html" | "text"> {
  return {
    subject: "Reset your CyNews password",
    text: `Hi ${opts.name},\n\nReset your password: ${opts.resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
<p>Hi ${opts.name},</p>
<p>You requested a password reset. Click the button below to choose a new password.</p>
<p><a href="${opts.resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a></p>
<p>Or copy this link: ${opts.resetUrl}</p>
<p>This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>`,
  };
}

export function orgInviteTemplate(opts: {
  inviterName: string;
  orgName: string;
  inviteUrl: string;
}): Pick<SendEmailOptions, "subject" | "html" | "text"> {
  return {
    subject: `${opts.inviterName} invited you to ${opts.orgName} on CyNews`,
    text: `${opts.inviterName} has invited you to join ${opts.orgName} on CyNews.\n\nAccept: ${opts.inviteUrl}`,
    html: `
<p>${opts.inviterName} has invited you to join <strong>${opts.orgName}</strong> on CyNews.</p>
<p><a href="${opts.inviteUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Accept Invitation</a></p>
<p>Or copy this link: ${opts.inviteUrl}</p>`,
  };
}

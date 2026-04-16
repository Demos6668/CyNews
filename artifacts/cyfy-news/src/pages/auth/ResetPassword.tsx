import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { authClient, resetPassword } from "@/lib/authClient";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * Password reset page — two code paths:
 *
 * • Link-based (?token=… in URL — legacy email link):
 *     Enter new password → resetPassword({ newPassword, token })
 *
 * • OTP-based (default, no token):
 *     Step 1: enter email → forgetPassword.emailOtp({ email })
 *     Step 2: enter OTP + new password → emailOtp.resetPassword(…)
 */

type OtpState = "email" | "otp";

export default function ResetPassword() {
  usePageTitle("Reset Password");
  const [, setLocation] = useLocation();

  // Detect token in URL (legacy link-based reset)
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // ── Link-based flow ───────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    setResetError(null);
    if (newPassword !== confirmPassword) { setResetError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setResetError("Password must be at least 8 characters"); return; }
    if (!token) return;
    setResetLoading(true);
    try {
      const result = await resetPassword({ newPassword, token });
      if (result.error) {
        setResetError(result.error.message ?? "Reset failed");
      } else {
        setResetSuccess(true);
        setTimeout(() => setLocation("/sign-in"), 2000);
      }
    } catch {
      setResetError("An unexpected error occurred");
    } finally {
      setResetLoading(false);
    }
  }

  // ── OTP-based flow ────────────────────────────────────────────────────────
  const [otpState, setOtpState] = useState<OtpState>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPassword, setOtpPassword] = useState("");
  const [otpConfirmPassword, setOtpConfirmPassword] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const result = await authClient.forgetPassword.emailOtp({ email: otpEmail });
      if (result.error) {
        setOtpError(result.error.message ?? "Failed to send code");
      } else {
        setOtpState("otp");
      }
    } catch {
      setOtpError("An unexpected error occurred");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleOtpReset(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);
    if (otpPassword !== otpConfirmPassword) { setOtpError("Passwords do not match"); return; }
    if (otpPassword.length < 8) { setOtpError("Password must be at least 8 characters"); return; }
    setOtpLoading(true);
    try {
      const result = await authClient.emailOtp.resetPassword({
        email: otpEmail,
        otp,
        password: otpPassword,
      });
      if (result.error) {
        setOtpError(result.error.message ?? "Reset failed");
      } else {
        setOtpSuccess(true);
        setTimeout(() => setLocation("/sign-in"), 2000);
      }
    } catch {
      setOtpError("An unexpected error occurred");
    } finally {
      setOtpLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Set new password</h1>
            <p className="text-muted-foreground mt-1">Choose a strong password.</p>
          </div>
          {resetSuccess ? (
            <div className="text-center space-y-2">
              <p className="text-green-500">Password updated! Redirecting to sign in…</p>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="bg-card border border-border rounded-xl p-6 space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {resetError && <p className="text-destructive text-sm">{resetError}</p>}
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {resetLoading ? "Updating…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Reset password</h1>
          <p className="text-muted-foreground mt-1">
            {otpState === "email"
              ? "Enter your email and we'll send a reset code."
              : `Code sent to ${otpEmail}. Enter it below with your new password.`}
          </p>
        </div>

        {otpSuccess ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <p className="text-green-500">Password updated! Redirecting to sign in…</p>
          </div>
        ) : otpState === "email" ? (
          <form onSubmit={handleSendOtp} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <input
              type="email"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              placeholder="Email address"
              required
              autoComplete="email"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {otpError && <p className="text-destructive text-sm">{otpError}</p>}
            <button
              type="submit"
              disabled={otpLoading}
              className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {otpLoading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpReset} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 tracking-widest text-center font-mono"
            />
            <input
              type="password"
              value={otpPassword}
              onChange={(e) => setOtpPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="password"
              value={otpConfirmPassword}
              onChange={(e) => setOtpConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {otpError && <p className="text-destructive text-sm">{otpError}</p>}
            <button
              type="submit"
              disabled={otpLoading}
              className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {otpLoading ? "Resetting…" : "Reset password"}
            </button>
            <button
              type="button"
              onClick={() => { setOtpState("email"); setOtp(""); setOtpError(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setLocation("/sign-in")}
            className="text-primary hover:underline"
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { signIn, emailOtp } from "@/lib/authClient";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function SignIn() {
  usePageTitle("Sign In");
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"password" | "otp">("password");

  // ── Password sign-in ──────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign-in failed");
      } else {
        setLocation("/");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  // ── Email OTP (magic code) ────────────────────────────────────────────────
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const result = await emailOtp.sendVerificationOtp({ email: otpEmail, type: "sign-in" });
      if (result.error) {
        setOtpError(result.error.message ?? "Failed to send code");
      } else {
        setOtpSent(true);
      }
    } catch {
      setOtpError("An unexpected error occurred");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const result = await signIn.emailOtp({ email: otpEmail, otp });
      if (result.error) {
        setOtpError(result.error.message ?? "Invalid code");
      } else {
        setLocation("/");
      }
    } catch {
      setOtpError("An unexpected error occurred");
    } finally {
      setOtpLoading(false);
    }
  }

  function switchMode(next: "password" | "otp") {
    setMode(next);
    setError(null);
    setOtpError(null);
    setOtpSent(false);
    setOtp("");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">CyNews</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["password", "otp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                {m === "password" ? "Password" : "Magic Code"}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <form onSubmit={handlePasswordSignIn} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                autoComplete="email"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setLocation("/reset-password")}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                We'll email you a one-time code — no password needed.
              </p>
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
                {otpLoading ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Code sent to <strong>{otpEmail}</strong>. Check your inbox.
              </p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 tracking-widest text-center font-mono"
              />
              {otpError && <p className="text-destructive text-sm">{otpError}</p>}
              <button
                type="submit"
                disabled={otpLoading}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {otpLoading ? "Verifying…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(""); setOtpError(null); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => setLocation("/sign-up")}
            className="text-primary hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}

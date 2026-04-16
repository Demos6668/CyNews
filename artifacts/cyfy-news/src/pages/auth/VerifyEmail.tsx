import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { verifyEmail } from "@/lib/authClient";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function VerifyEmail() {
  usePageTitle("Verify Email");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    token ? "verifying" : "error"
  );
  const [errorMsg, setErrorMsg] = useState("Missing verification token.");

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const result = await verifyEmail({ query: { token } });
        if (result.error) {
          setErrorMsg(result.error.message ?? "Verification failed");
          setStatus("error");
        } else {
          setStatus("success");
          setTimeout(() => setLocation("/"), 2000);
        }
      } catch {
        setErrorMsg("An unexpected error occurred");
        setStatus("error");
      }
    })();
  }, [token, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        {status === "verifying" && (
          <>
            <div className="text-5xl">⏳</div>
            <h2 className="text-2xl font-bold">Verifying your email…</h2>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-5xl">✅</div>
            <h2 className="text-2xl font-bold">Email verified!</h2>
            <p className="text-muted-foreground">Redirecting you to the dashboard…</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-5xl">❌</div>
            <h2 className="text-2xl font-bold">Verification failed</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setLocation("/sign-in")}
              className="text-primary hover:underline text-sm"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

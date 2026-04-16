/**
 * Better Auth browser client (React).
 *
 * Import `authClient` anywhere in the React app to sign in, sign up,
 * get the current session, etc.
 *
 * All methods proxy to /api/auth/* on the backend.
 */

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const backendUrl = import.meta.env.VITE_API_URL as string | undefined;

export const authClient = createAuthClient({
  /** Base URL of the API server. Defaults to same origin in production. */
  baseURL: backendUrl ?? "",
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export type AuthClient = typeof authClient;

// Convenience re-exports for the most common operations
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  sendVerificationEmail,
  resetPassword,
  verifyEmail,
  emailOtp,
} = authClient;

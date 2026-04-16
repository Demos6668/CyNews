/**
 * Session context — makes the current user & session available to the
 * entire React tree without prop-drilling.
 *
 * Usage:
 *   const { user, session, isLoading, isAuthenticated } = useSessionContext();
 */

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "@/lib/authClient";

interface SessionContextValue {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
  } | null;
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, isPending, refetch } = useSession();

  const value: SessionContextValue = {
    user: data?.user
      ? {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          emailVerified: data.user.emailVerified,
          image: data.user.image,
        }
      : null,
    session: data?.session
      ? {
          id: data.session.id,
          token: data.session.token,
          expiresAt: new Date(data.session.expiresAt),
        }
      : null,
    isLoading: isPending,
    isAuthenticated: !!data?.user,
    refetch,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used within a <SessionProvider>");
  }
  return ctx;
}

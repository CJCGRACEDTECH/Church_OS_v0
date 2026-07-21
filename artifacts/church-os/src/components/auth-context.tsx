import React, { createContext, useContext, ReactNode } from "react";
import { useClerk, useUser } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

type LocalUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  preferredLanguage: string | null;
  emergencyContactName: string | null;
  emergencyContactPhoneNumber: string | null;
  streetAddress: string | null;
  apartmentUnit: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  role: "admin" | "member";
  adminLevel: string | null;
  adminTitle: string | null;
  adminPermissions: string[];
  assignedMinistry: string | null;
  accountStatus: string;
  createdByUserId: number | null;
  churchId: number;
  churchName: string;
  createdAt: string;
  lastLoginAt: string | null;
  authProviders: string[];
  hasPassword: boolean;
};

interface AuthContextType {
  user: LocalUser | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function ClerkBackedAuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { data: localUser, isLoading: localLoading, error: localError } = useGetMe();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // While Clerk says the user IS signed in, any error other than 403 is treated
  // as transient — keep showing the loading spinner rather than redirecting to
  // /sign-in. Reasons:
  //   • 401 immediately after OAuth: normal gap while the JWT propagates (~1-5 s)
  //   • Any future 401: Clerk automatically refreshes its short-lived tokens and
  //     will set isSignedIn=false on its own if the session truly dies. We don't
  //     need to sign out manually — that only creates redirect loops.
  //   • 403: the only case where we must actively sign out (no local account).
  const errorStatus = localError ? (localError as { status?: number }).status : undefined;
  const isTransientError = !!isSignedIn && !!localError && errorStatus !== 403;
  const isLoading = !clerkLoaded || (!!isSignedIn && (localLoading || isTransientError));
  const user = clerkLoaded && isSignedIn && localUser ? (localUser as LocalUser) : null;

  // Sign out only on 403 — Clerk identity exists but has no local DB account.
  // (Clerk handles 401/session-expiry itself via token refresh + isSignedIn=false.)
  React.useEffect(() => {
    if (clerkLoaded && isSignedIn && !localLoading && errorStatus === 403) {
      void signOut().then(() => {
        queryClient.clear();
      });
    }
  }, [clerkLoaded, isSignedIn, localLoading, errorStatus, signOut, queryClient]);

  const logout = () => {
    void signOut().then(() => {
      queryClient.clear();
      setLocation("/");
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <ClerkBackedAuthProvider>{children}</ClerkBackedAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/sign-in");
    } else if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      setLocation(user.role === "admin" ? "/admin" : "/member");
    }
  }, [user, isLoading, setLocation, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    return null;
  }

  return <Component />;
}

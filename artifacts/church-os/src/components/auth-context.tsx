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
  const { data: localUser, isLoading: localLoading, isFetching: localFetching, error: localError } = useGetMe();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // A 401 right after OAuth is transient — Clerk is still propagating the JWT.
  // Hold the loading state while React Query is actively fetching/retrying so
  // HomeRoute doesn't redirect to /sign-in and create a loop.
  // Once all retries are exhausted (localFetching=false) treat it as a real
  // error and fall through to the signout effect below.
  const errorStatus = localError ? (localError as { status?: number }).status : undefined;
  const isTransientError = !!isSignedIn && !!localError && errorStatus !== 403 && (localLoading || localFetching);
  const isLoading = !clerkLoaded || (!!isSignedIn && (localLoading || isTransientError));
  const user = clerkLoaded && isSignedIn && localUser ? (localUser as LocalUser) : null;

  // Sign the user out when:
  //   • 403 — Clerk identity has no matching local account
  //   • 401 after all retries exhausted — Clerk session is genuinely dead
  // Do NOT sign out during active retries (localFetching=true): that window is
  // the normal transient gap right after an OAuth redirect.
  React.useEffect(() => {
    const status = localError ? (localError as { status?: number }).status : undefined;
    const retriesExhausted = !localLoading && !localFetching;
    const isDeadSession = status === 403 || (status === 401 && retriesExhausted);
    if (clerkLoaded && isSignedIn && retriesExhausted && isDeadSession) {
      void signOut().then(() => {
        queryClient.clear();
      });
    }
  }, [clerkLoaded, isSignedIn, localLoading, localFetching, localError, signOut, queryClient]);

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

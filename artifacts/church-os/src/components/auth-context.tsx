import React, { createContext, useContext, useState, ReactNode } from "react";
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
  isDemoMode: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { data: localUser, isLoading: localLoading } = useGetMe();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isDemoMode, setIsDemoMode] = useState(
    () => sessionStorage.getItem("demo_mode") === "true",
  );

  const isLoading = isDemoMode
    ? localLoading
    : !clerkLoaded || (!!isSignedIn && localLoading);

  const isAuthed = isDemoMode || (clerkLoaded && !!isSignedIn);
  const user = isAuthed && localUser ? (localUser as LocalUser) : null;

  const logout = () => {
    if (isDemoMode) {
      sessionStorage.removeItem("demo_mode");
      setIsDemoMode(false);
      void fetch("/api/auth/demo-session", { method: "DELETE", credentials: "include" });
      queryClient.clear();
      setLocation("/sign-in");
      return;
    }
    void signOut().then(() => {
      queryClient.clear();
      setLocation("/");
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isDemoMode, logout }}>
      {children}
    </AuthContext.Provider>
  );
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

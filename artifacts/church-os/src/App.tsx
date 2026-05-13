import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, ProtectedRoute } from "@/components/auth-context";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";

import Unauthorized from "@/pages/unauthorized";
import NotFound from "@/pages/not-found";

import AdminDashboard from "@/pages/admin-dashboard";
import AdminProfile from "@/pages/admin/profile";
import AdminMembers from "@/pages/admin/members";
import AdminHouseholds from "@/pages/admin/households";
import AdminServices from "@/pages/admin/services";
import AdminAttendance from "@/pages/admin/attendance";
import AdminCheckIn from "@/pages/admin/check-in";
import AdminGiving from "@/pages/admin/giving";
import AdminReports from "@/pages/admin/reports";
import AdminSettings from "@/pages/admin/settings";
import AdminManagement from "@/pages/admin/admin-management";
import AdminInviteAccept from "@/pages/admin/invite-accept";

import MemberDashboard from "@/pages/member-dashboard";
import MemberProfile from "@/pages/member/profile";
import MemberHousehold from "@/pages/member/household";
import MemberGive from "@/pages/member/give";
import MemberServices from "@/pages/member/services";
import MemberSettings from "@/pages/member/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#6366f1",
    colorForeground: "#111827",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f9fafb",
    colorInputForeground: "#111827",
    colorNeutral: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl shadow-xl w-[440px] max-w-full overflow-hidden border border-gray-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold text-xl",
    headerSubtitle: "text-gray-500 text-sm",
    socialButtonsBlockButtonText: "text-gray-700 font-medium",
    formFieldLabel: "text-gray-700 text-sm font-medium",
    footerActionLink: "text-indigo-600 font-medium hover:text-indigo-500",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400 text-xs",
    identityPreviewEditButton: "text-indigo-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-gray-700",
    logoBox: "flex justify-center py-2",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50 transition-colors",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors",
    formFieldInput: "border-gray-200 bg-gray-50 text-gray-900 focus:border-indigo-400 focus:ring-indigo-400",
    footerAction: "bg-gray-50 border-t border-gray-100 px-6 py-4",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50 border border-red-200 rounded-lg",
    otpCodeFieldInput: "border-gray-200 bg-gray-50 text-gray-900",
    formFieldRow: "gap-2",
    main: "px-6 pb-6",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Redirect to="/sign-in" />;
  if (user.role === "admin") return <Redirect to="/admin" />;
  return <Redirect to="/member" />;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </div>
  );
}

function AdminRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["admin"]} />;
}

function MemberRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["member"]} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/" component={HomeRedirect} />
      <Route path="/unauthorized" component={Unauthorized} />
      <Route path="/admin/invite/:token" component={AdminInviteAccept} />

      {/* Admin routes */}
      <Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route>
      <Route path="/admin/profile">{() => <AdminRoute component={AdminProfile} />}</Route>
      <Route path="/admin/members">{() => <AdminRoute component={AdminMembers} />}</Route>
      <Route path="/admin/households">{() => <AdminRoute component={AdminHouseholds} />}</Route>
      <Route path="/admin/services">{() => <AdminRoute component={AdminServices} />}</Route>
      <Route path="/admin/attendance">{() => <AdminRoute component={AdminAttendance} />}</Route>
      <Route path="/admin/check-in">{() => <AdminRoute component={AdminCheckIn} />}</Route>
      <Route path="/admin/giving">{() => <AdminRoute component={AdminGiving} />}</Route>
      <Route path="/admin/reports">{() => <AdminRoute component={AdminReports} />}</Route>
      <Route path="/admin/settings">{() => <AdminRoute component={AdminSettings} />}</Route>
      <Route path="/admin/admins">{() => <AdminRoute component={AdminManagement} />}</Route>

      {/* Member routes */}
      <Route path="/member">{() => <MemberRoute component={MemberDashboard} />}</Route>
      <Route path="/member/profile">{() => <MemberRoute component={MemberProfile} />}</Route>
      <Route path="/member/household">{() => <MemberRoute component={MemberHousehold} />}</Route>
      <Route path="/member/give">{() => <MemberRoute component={MemberGive} />}</Route>
      <Route path="/member/services">{() => <MemberRoute component={MemberServices} />}</Route>
      <Route path="/member/settings">{() => <MemberRoute component={MemberSettings} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={basePath || "/"}
      signUpFallbackRedirectUrl={basePath || "/"}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to CJC International",
          },
        },
        signUp: {
          start: {
            title: "Join CJC International",
            subtitle: "Create your account to get started",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AuthProvider>
            <Router />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

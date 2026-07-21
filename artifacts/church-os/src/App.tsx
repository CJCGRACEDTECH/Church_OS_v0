import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, Link, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, ProtectedRoute } from "@/components/auth-context";
import { ClerkProvider, SignIn, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

import Unauthorized from "@/pages/unauthorized";
import NotFound from "@/pages/not-found";
import AttendanceCheckIn from "@/pages/attendance-check-in";
import ConnectPage from "@/pages/connect";
import RequestAccountPage from "@/pages/request-account";
import { EvangelismContactPage, EvangelismQrPage } from "@/pages/evangelism-public";
import PublicEventsPage from "@/pages/events-public";
import PublicSermonsPage from "@/pages/sermons";

import HomePage from "@/pages/home";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminProfile from "@/pages/admin/profile";
import AdminMembers from "@/pages/admin/members";
import AdminHouseholdInbox from "@/pages/admin/household-inbox";
import AdminServices from "@/pages/admin/services";
import AdminAttendance from "@/pages/admin/attendance";
import AdminCheckIn from "@/pages/admin/check-in";
import AdminGiving from "@/pages/admin/giving";
import AdminEvangelism from "@/pages/admin/evangelism";
import AdminSermons from "@/pages/admin/sermons";
import AdminSettings from "@/pages/admin/settings";
import AdminInviteAccept from "@/pages/admin/invite-accept";

import MemberDashboard from "@/pages/member-dashboard";
import MemberProfile from "@/pages/member/profile";
import MemberHousehold from "@/pages/member/household";
import MemberGive from "@/pages/member/give";
import MemberServices from "@/pages/member/services";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
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
    logoImageUrl: `${window.location.origin}${basePath}/cjc-logo.webp`,
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
    footer: "!hidden",
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
    logoBox: "flex justify-center pt-6 pb-1",
    logoImage: "h-16 w-auto",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50 transition-colors",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors",
    formFieldInput: "border-gray-200 bg-gray-50 text-gray-900 focus:border-indigo-400 focus:ring-indigo-400",
    footerAction: "!hidden",
    badge: "!hidden",
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

function HomeRoute() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        setLocation(user.role === "admin" ? "/admin" : "/member", { replace: true });
      } else {
        setLocation("/sign-in", { replace: true });
      }
    }
  }, [isLoading, user, setLocation]);

  return null;
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: "#eef0f8" }}>
      <nav style={{ background: "#181d2e" }} className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/cjc-logo.webp`} alt="CJC Church" className="h-10 w-auto" style={{ mixBlendMode: "screen" }} />
          <span className="text-white font-semibold text-base tracking-tight">CJC Church</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {["Home", "About", "Sermons", "Events", "Connect"].map((item) => (
            <a key={item} href="#" className="text-gray-400 text-sm hover:text-white transition-colors">{item}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="text-white text-sm border border-white/20 rounded-md px-4 py-1.5 hover:bg-white/10 transition-colors">Login</button>
          <button className="bg-indigo-600 text-white text-sm rounded-md px-4 py-1.5 hover:bg-indigo-700 transition-colors font-medium">Give</button>
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>

      <footer className="py-4 text-center text-xs text-gray-400">
        Church OS &middot; CJC Church
      </footer>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthPageShell>
      <div className="flex flex-col items-center">
        <div className="bg-white rounded-2xl shadow-xl w-[440px] max-w-full overflow-hidden border border-gray-100">
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            fallbackRedirectUrl={basePath || "/"}
            appearance={{ elements: { cardBox: "!shadow-none !border-0 !rounded-none w-full", rootBox: "w-full" } }}
          />
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex flex-col items-center gap-2">
            <Link href="/request-account" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Already a member? Request account access
            </Link>
            <Link href="/connect" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              New here? Connect with us
            </Link>
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}

function SignUpPage() {
  return (
    <AuthPageShell>
      <div className="w-[440px] max-w-full rounded-2xl border border-gray-100 bg-white px-6 py-5 text-center shadow-xl">
        <h1 className="text-lg font-semibold text-gray-900">Account creation is not available</h1>
        <p className="mt-2 text-sm text-gray-500">Please contact church administration for access.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Link href="/request-account" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Already a member? Request account access
          </Link>
          <Link href="/connect" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            New here? Connect with us
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
}

function AdminRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["admin"]} />;
}

function MemberRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["member"]} />;
}

// Member pages that admins can also access (they are members of the church too)
function AnyAuthRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["admin", "member"]} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/" component={HomeRoute} />

      <Route path="/unauthorized" component={Unauthorized} />
      <Route path="/attendance/check-in/:token" component={AttendanceCheckIn} />
      <Route path="/admin/invite/:token" component={AdminInviteAccept} />
      <Route path="/connect" component={ConnectPage} />
      <Route path="/request-account" component={RequestAccountPage} />
      <Route path="/events" component={PublicEventsPage} />
      <Route path="/sermons" component={PublicSermonsPage} />
      <Route path="/evangelism/e/:token/contact" component={EvangelismContactPage} />
      <Route path="/evangelism/e/:token/qr" component={EvangelismQrPage} />

      {/* Admin routes */}
      <Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route>
      <Route path="/admin/profile">{() => <AdminRoute component={AdminProfile} />}</Route>
      <Route path="/admin/household-inbox">{() => <AdminRoute component={AdminHouseholdInbox} />}</Route>
      <Route path="/admin/members/:id">{() => <AdminRoute component={AdminMembers} />}</Route>
      <Route path="/admin/members">{() => <AdminRoute component={AdminMembers} />}</Route>
      <Route path="/admin/households">{() => <Redirect to="/admin/members" />}</Route>
      <Route path="/admin/services/:id">{() => <AdminRoute component={AdminServices} />}</Route>
      <Route path="/admin/services">{() => <AdminRoute component={AdminServices} />}</Route>
      <Route path="/admin/attendance/:id">{() => <AdminRoute component={AdminAttendance} />}</Route>
      <Route path="/admin/attendance">{() => <AdminRoute component={AdminAttendance} />}</Route>
      <Route path="/admin/check-in">{() => <AdminRoute component={AdminCheckIn} />}</Route>
      <Route path="/admin/giving">{() => <AdminRoute component={AdminGiving} />}</Route>
      <Route path="/admin/evangelism/events/:id">{() => <AdminRoute component={AdminEvangelism} />}</Route>
      <Route path="/admin/evangelism/contacts">{() => <AdminRoute component={AdminEvangelism} />}</Route>
      <Route path="/admin/evangelism">{() => <AdminRoute component={AdminEvangelism} />}</Route>
      <Route path="/admin/sermons">{() => <AdminRoute component={AdminSermons} />}</Route>
      <Route path="/admin/reports">{() => <Redirect to="/admin" />}</Route>
      <Route path="/admin/settings">{() => <AdminRoute component={AdminSettings} />}</Route>
      <Route path="/admin/admins">{() => <Redirect to="/admin/settings?section=admins" />}</Route>

      {/* Member routes — all accessible to admins too */}
      <Route path="/member">{() => <AnyAuthRoute component={MemberDashboard} />}</Route>
      <Route path="/member/profile">{() => <AnyAuthRoute component={MemberProfile} />}</Route>
      <Route path="/member/household">{() => <AnyAuthRoute component={MemberHousehold} />}</Route>
      <Route path="/member/give">{() => <AnyAuthRoute component={MemberGive} />}</Route>
      <Route path="/member/services/:id">{() => <AnyAuthRoute component={MemberServices} />}</Route>
      <Route path="/member/services">{() => <AnyAuthRoute component={MemberServices} />}</Route>
      <Route path="/member/settings">{() => <Redirect to="/member/profile" />}</Route>

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
            title: "CJC Church",
            subtitle: "Sign in to your staff or member account",
          },
        },
        signUp: {
          start: {
            title: "CJC Church",
            subtitle: "Create your staff or member account",
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

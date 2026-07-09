import { useEffect, useRef, useState } from "react";
import { Switch, Route, Redirect, Link, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, ProtectedRoute } from "@/components/auth-context";
import { ClerkProvider, SignIn, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";

import Unauthorized from "@/pages/unauthorized";
import NotFound from "@/pages/not-found";
import AttendanceCheckIn from "@/pages/attendance-check-in";
import ConnectPage from "@/pages/connect";
import RequestAccountPage from "@/pages/request-account";
import { EvangelismContactPage, EvangelismQrPage } from "@/pages/evangelism-public";

import AdminDashboard from "@/pages/admin-dashboard";
import AdminProfile from "@/pages/admin/profile";
import AdminMembers from "@/pages/admin/members";
import AdminHouseholdInbox from "@/pages/admin/household-inbox";
import AdminServices from "@/pages/admin/services";
import AdminAttendance from "@/pages/admin/attendance";
import AdminCheckIn from "@/pages/admin/check-in";
import AdminGiving from "@/pages/admin/giving";
import AdminEvangelism from "@/pages/admin/evangelism";
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
    logoPlacement: "none" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/cjc-logo.png`,
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
    logoBox: "flex justify-center pt-6 pb-1",
    logoImage: "h-16 w-auto",
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

const DEMO_ACCOUNTS = [
  { label: "Super Admin Access", role: "super_admin", color: "bg-indigo-600 hover:bg-indigo-700" },
  { label: "Admin Access", role: "admin", color: "bg-sky-600 hover:bg-sky-700" },
  { label: "Children Ministry Access", role: "children_ministry", color: "bg-amber-600 hover:bg-amber-700" },
  { label: "Member Access", role: "member", color: "bg-slate-600 hover:bg-slate-700" },
];

function DemoLoginButtons() {
  const [, setLocation] = useLocation();
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDemo(idx: number) {
    setLoadingIdx(idx);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: DEMO_ACCOUNTS[idx].role }),
        credentials: "include",
      });
      const data = await res.json() as { ok?: boolean; role?: string; token?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not start session.");
        return;
      }
      sessionStorage.setItem("demo_mode", "true");
      sessionStorage.setItem("demo_token", data.token ?? "");
      setLocation(data.role === "admin" ? "/admin" : "/member");
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start session.";
      setError(msg);
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <div className="w-[560px] max-w-full mt-3">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">Quick Access</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((acct, idx) => (
            <button
              key={acct.role}
              onClick={() => handleDemo(idx)}
              disabled={loadingIdx !== null}
              className={`flex-1 ${acct.color} text-white text-sm font-medium rounded-lg py-2 px-3 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5`}
            >
              {loadingIdx === idx ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
              ) : null}
              {acct.label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}

function SignInPage() {
  if (!clerkPubKey) {
    return (
      <AuthPageShell>
        <div className="flex flex-col items-center">
          <DemoLoginButtons />
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="flex flex-col items-center">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={basePath || "/"}
        />
        <DemoLoginButtons />
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
        <DemoLoginButtons />
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

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/" component={HomeRedirect} />
      <Route path="/unauthorized" component={Unauthorized} />
      <Route path="/attendance/check-in/:token" component={AttendanceCheckIn} />
      <Route path="/admin/invite/:token" component={AdminInviteAccept} />
      <Route path="/connect" component={ConnectPage} />
      <Route path="/request-account" component={RequestAccountPage} />
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
      <Route path="/admin/reports">{() => <Redirect to="/admin" />}</Route>
      <Route path="/admin/settings">{() => <AdminRoute component={AdminSettings} />}</Route>
      <Route path="/admin/admins">{() => <Redirect to="/admin/settings?section=admins" />}</Route>

      {/* Member routes */}
      <Route path="/member">{() => <MemberRoute component={MemberDashboard} />}</Route>
      <Route path="/member/profile">{() => <MemberRoute component={MemberProfile} />}</Route>
      <Route path="/member/household">{() => <MemberRoute component={MemberHousehold} />}</Route>
      <Route path="/member/give">{() => <MemberRoute component={MemberGive} />}</Route>
      <Route path="/member/services/:id">{() => <MemberRoute component={MemberServices} />}</Route>
      <Route path="/member/services">{() => <MemberRoute component={MemberServices} />}</Route>
      <Route path="/member/settings">{() => <Redirect to="/member/profile" />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider clerkEnabled={false}>
            <Router />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

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

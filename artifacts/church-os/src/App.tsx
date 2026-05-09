import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/components/auth-context";

import Login from "@/pages/login";
import Unauthorized from "@/pages/unauthorized";
import NotFound from "@/pages/not-found";

import AdminDashboard from "@/pages/admin-dashboard";
import AdminMembers from "@/pages/admin/members";
import AdminHouseholds from "@/pages/admin/households";
import AdminServices from "@/pages/admin/services";
import AdminAttendance from "@/pages/admin/attendance";
import AdminCheckIn from "@/pages/admin/check-in";
import AdminGiving from "@/pages/admin/giving";
import AdminReports from "@/pages/admin/reports";
import AdminSettings from "@/pages/admin/settings";

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

function AdminRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["admin"]} />;
}

function MemberRoute({ component: C }: { component: React.ComponentType }) {
  return <ProtectedRoute component={C} allowedRoles={["member"]} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/unauthorized" component={Unauthorized} />

      {/* Admin routes */}
      <Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route>
      <Route path="/admin/members">{() => <AdminRoute component={AdminMembers} />}</Route>
      <Route path="/admin/households">{() => <AdminRoute component={AdminHouseholds} />}</Route>
      <Route path="/admin/services">{() => <AdminRoute component={AdminServices} />}</Route>
      <Route path="/admin/attendance">{() => <AdminRoute component={AdminAttendance} />}</Route>
      <Route path="/admin/check-in">{() => <AdminRoute component={AdminCheckIn} />}</Route>
      <Route path="/admin/giving">{() => <AdminRoute component={AdminGiving} />}</Route>
      <Route path="/admin/reports">{() => <AdminRoute component={AdminReports} />}</Route>
      <Route path="/admin/settings">{() => <AdminRoute component={AdminSettings} />}</Route>

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

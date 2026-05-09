import { ShieldX } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { ADMIN_ROUTES, AUTH_ROUTES, MEMBER_ROUTES } from "@/lib/routes";

export default function Unauthorized() {
  const { user } = useAuth();

  const dashboardHref = user
    ? user.role === "admin"
      ? ADMIN_ROUTES.DASHBOARD
      : MEMBER_ROUTES.DASHBOARD
    : AUTH_ROUTES.LOGIN;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-md px-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground mt-2">
            You don't have permission to view this page. Please contact your church
            administrator if you believe this is an error.
          </p>
        </div>
        <Button asChild>
          <Link href={dashboardHref}>Go to my dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

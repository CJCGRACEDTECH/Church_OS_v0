import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-context";
import {
  LayoutDashboard,
  CircleUserRound,
  Users,
  CalendarDays,
  Smile,
  BadgeDollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Inbox,
  Megaphone,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ADMIN_ROUTES } from "@/lib/routes";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: ADMIN_ROUTES.DASHBOARD },
  { label: "Profile", icon: CircleUserRound, href: ADMIN_ROUTES.PROFILE },
  { label: "Members", icon: Users, href: ADMIN_ROUTES.MEMBERS, permission: PERMISSIONS.MEMBER_DIRECTORY },
  { label: "Inbox", icon: Inbox, href: ADMIN_ROUTES.HOUSEHOLD_INBOX, superAdminOnly: true },
  { label: "Services", icon: CalendarDays, href: ADMIN_ROUTES.SERVICES, permission: PERMISSIONS.EVENT_MANAGEMENT },
  { label: "Attendance", icon: BarChart3, href: ADMIN_ROUTES.ATTENDANCE, permission: PERMISSIONS.ATTENDANCE_MANAGEMENT },
  { label: "Children Ministry", icon: Smile, href: ADMIN_ROUTES.CHECK_IN, permission: PERMISSIONS.ATTENDANCE_CHECKIN },
  { label: "Giving", icon: BadgeDollarSign, href: ADMIN_ROUTES.GIVING, permission: PERMISSIONS.GIVING_MANAGEMENT },
  { label: "Evangelism", icon: Megaphone, href: ADMIN_ROUTES.EVANGELISM, permission: PERMISSIONS.EVENT_MANAGEMENT },
  { label: "Settings", icon: Settings, href: ADMIN_ROUTES.SETTINGS, permission: PERMISSIONS.SYSTEM_SETTINGS },
  { label: "My Member Profile", icon: UserCircle2, href: "/member/profile", memberPortal: true },
] satisfies Array<{
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: string;
  permission?: Permission;
  superAdminOnly?: boolean;
  memberPortal?: boolean;
}>;

function SidebarNav() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const permissions = user?.adminPermissions ?? [];
  const isChildrenMinistryOnly = permissions.length === 1 && permissions.includes(PERMISSIONS.ATTENDANCE_CHECKIN);

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-4 pt-5 pb-3 flex flex-col items-center">
        <img
          src="/cjc-logo.webp"
          alt="CJC Church"
          className="w-full max-h-20 object-contain"
          style={{ mixBlendMode: "screen" }}
        />
        <div className="text-white font-bold text-2xl mt-2 text-center tracking-tight">
          {user?.churchName ?? "CJC Church"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.filter((item) => {
            if (isChildrenMinistryOnly && item.href === ADMIN_ROUTES.DASHBOARD) return false;
            if (item.superAdminOnly && user?.adminLevel !== "super_admin") return false;
            if (item.memberPortal) return true;
            if (!item.permission) return true;
            return hasPermission("admin", item.permission, user?.adminPermissions);
          }).map((item, idx, arr) => {
            const isActive =
              item.href === "/admin"
                ? location === item.href
                : location === item.href || location.startsWith(item.href + "/");
            const prevItem = arr[idx - 1];
            const showDivider = item.memberPortal && prevItem && !prevItem.memberPortal;
            return (
              <React.Fragment key={item.label}>
                {showDivider && <div className="my-2 border-t border-white/10" />}
                <Link
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-blue-100/80 hover:text-white hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className={isActive ? "text-[#D4AF37]" : ""} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="p-4 mt-auto border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-9 w-9 bg-white/10 border border-sidebar-border text-white">
            <AvatarFallback className="bg-transparent">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-blue-100/70 truncate">{user?.email}</p>
            {user?.role === "admin" && (
              <p className="text-[11px] capitalize text-blue-100/50 truncate">
                {(user.adminLevel ?? "pastor").replace("_", " ")}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-blue-100/80 hover:text-white hover:bg-white/10 border-0"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut size={16} className="mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border">
        <SidebarNav />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
          <img src="/cjc-logo.webp" alt="CJC Church" className="h-8 w-auto" style={{ mixBlendMode: "multiply" }} />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <SidebarNav />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

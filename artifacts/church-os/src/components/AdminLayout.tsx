import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-context";
import {
  LayoutDashboard,
  Users,
  Home,
  CalendarDays,
  CheckSquare,
  BadgeDollarSign,
  BarChart3,
  Settings,
  LogOut,
  Building,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ADMIN_ROUTES } from "@/lib/routes";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: ADMIN_ROUTES.DASHBOARD },
  { label: "Members", icon: Users, href: ADMIN_ROUTES.MEMBERS, comingSoon: true },
  { label: "Households", icon: Home, href: ADMIN_ROUTES.HOUSEHOLDS, comingSoon: true },
  { label: "Services", icon: CalendarDays, href: ADMIN_ROUTES.SERVICES, comingSoon: true },
  { label: "Attendance", icon: BarChart3, href: ADMIN_ROUTES.ATTENDANCE, comingSoon: true },
  { label: "Sunday Check-In", icon: CheckSquare, href: ADMIN_ROUTES.CHECK_IN, comingSoon: true },
  { label: "Giving", icon: BadgeDollarSign, href: ADMIN_ROUTES.GIVING, comingSoon: true },
  { label: "Reports", icon: BarChart3, href: ADMIN_ROUTES.REPORTS, comingSoon: true },
  { label: "Settings", icon: Settings, href: ADMIN_ROUTES.SETTINGS, comingSoon: true },
];

function SidebarNav() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <div className="flex items-center gap-3 font-semibold text-xl text-white">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
            <Building size={18} className="text-white" />
          </div>
          Church OS
        </div>
        <div className="text-sidebar-foreground/70 text-sm mt-1 ml-11">
          {user?.churchName ?? "CJC International"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : item.comingSoon
                    ? "text-sidebar-foreground/50 hover:text-sidebar-foreground/70 hover:bg-sidebar-foreground/5"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.comingSoon && !isActive && (
                  <span className="text-[10px] uppercase font-bold bg-sidebar-foreground/10 px-1.5 py-0.5 rounded text-sidebar-foreground/50">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 mt-auto border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-9 w-9 bg-sidebar-accent border border-sidebar-border text-white">
            <AvatarFallback className="bg-transparent">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent border-0"
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
          <div className="flex items-center gap-2 font-semibold">
            <Building size={20} className="text-primary" />
            Church OS
          </div>
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

import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-context";
import {
  Home,
  User,
  Inbox,
  BadgeDollarSign,
  CalendarDays,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MEMBER_ROUTES } from "@/lib/routes";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: MEMBER_ROUTES.DASHBOARD },
  { label: "Profile", icon: User, href: MEMBER_ROUTES.PROFILE },
  { label: "Request Center", icon: Inbox, href: MEMBER_ROUTES.HOUSEHOLD },
  { label: "Give", icon: BadgeDollarSign, href: MEMBER_ROUTES.GIVE },
  { label: "Services", icon: CalendarDays, href: MEMBER_ROUTES.SERVICES },
];

function SidebarNav() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

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
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.label}
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
            <p className="text-xs text-blue-100/70 truncate">Member</p>
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

export default function MemberLayout({ children }: { children: ReactNode }) {
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

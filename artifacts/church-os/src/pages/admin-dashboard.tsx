import React from "react";
import { Link } from "wouter";
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
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin", active: true },
  { label: "Members", icon: Users, href: "#", disabled: true },
  { label: "Households", icon: Home, href: "#", disabled: true },
  { label: "Services", icon: CalendarDays, href: "#", disabled: true },
  { label: "Attendance", icon: BarChart3, href: "#", disabled: true },
  { label: "Sunday Check-In", icon: CheckSquare, href: "#", disabled: true },
  { label: "Giving", icon: BadgeDollarSign, href: "#", disabled: true },
  { label: "Reports", icon: BarChart3, href: "#", disabled: true },
  { label: "Settings", icon: Settings, href: "#", disabled: true },
];

const metricCards = [
  { label: "Total Members", value: "247", trend: "+4 this week" },
  { label: "Avg Attendance", value: "189", trend: "+12% vs last month" },
  { label: "Children Check-In", value: "43", trend: "Last Sunday" },
  { label: "Giving YTD", value: "$12,450", trend: "On track" },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <div className="flex items-center gap-3 font-semibold text-xl text-white">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
            <Building size={18} className="text-white" />
          </div>
          Church OS
        </div>
        <div className="text-sidebar-foreground/70 text-sm mt-1 ml-11">
          {user?.churchName || "CJC International"}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => (
            <div key={item.label}>
              {item.disabled ? (
                <div className="flex items-center justify-between px-3 py-2 text-sidebar-foreground/50 cursor-not-allowed group">
                  <div className="flex items-center gap-3">
                    <item.icon size={18} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-sidebar-foreground/10 px-1.5 py-0.5 rounded text-sidebar-foreground/50">
                    Soon
                  </span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                    item.active 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-4 mt-auto border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-9 w-9 bg-sidebar-accent border border-sidebar-border text-white">
            <AvatarFallback className="bg-transparent">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
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
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {user?.firstName}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's what's happening at {user?.churchName || "your church"} today.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map((card) => (
                <Card key={card.label} className="border-border/50 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{card.trend}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="col-span-1 border-border/50 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center mb-4">
                  <CalendarDays className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="font-semibold text-lg">Upcoming Services</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Service scheduling and planning features are coming soon to Church OS.
                </p>
                <Button variant="outline" className="mt-6" disabled>Configure Services</Button>
              </Card>

              <Card className="col-span-1 border-border/50 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center mb-4">
                  <Users className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="font-semibold text-lg">Recent Activity</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Member activity streams and notifications are coming soon.
                </p>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

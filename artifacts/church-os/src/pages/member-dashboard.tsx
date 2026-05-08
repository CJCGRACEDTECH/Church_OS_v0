import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-context";
import {
  Home,
  User,
  Users,
  BadgeDollarSign,
  CalendarDays,
  Settings,
  LogOut,
  Building,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { label: "Home", icon: Home, href: "/member", active: true },
  { label: "Profile", icon: User, href: "#", disabled: true },
  { label: "Household", icon: Users, href: "#", disabled: true },
  { label: "Give", icon: BadgeDollarSign, href: "#", disabled: true },
  { label: "Services", icon: CalendarDays, href: "#", disabled: true },
  { label: "Settings", icon: Settings, href: "#", disabled: true },
];

export default function MemberDashboard() {
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
            <p className="text-xs text-sidebar-foreground/70 truncate">Member</p>
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
          <div className="max-w-5xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {user?.firstName}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Your personal portal for {user?.churchName || "your church"}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/50 shadow-sm transition-all hover:shadow-md cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    My Profile
                  </CardTitle>
                  <CardDescription>View and update your personal information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 pt-2">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm transition-all hover:shadow-md cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    My Household
                  </CardTitle>
                  <CardDescription>Manage your family members</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 pt-4">
                    <div className="flex -space-x-2">
                      <Avatar className="h-8 w-8 border-2 border-background">
                        <AvatarFallback className="bg-primary/10 text-xs">Me</AvatarFallback>
                      </Avatar>
                      <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        +
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground ml-2">1 Member</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm transition-all hover:shadow-md cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BadgeDollarSign className="h-5 w-5 text-primary" />
                    My Giving
                  </CardTitle>
                  <CardDescription>View your giving history and manage recurring gifts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold pt-2">$0.00</div>
                  <p className="text-sm text-muted-foreground">Year to Date</p>
                  <Button variant="outline" className="w-full mt-4" disabled>Give Now</Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm transition-all hover:shadow-md cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Upcoming Services
                  </CardTitle>
                  <CardDescription>See what's happening this week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground italic py-6 text-center">
                    No upcoming services scheduled
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

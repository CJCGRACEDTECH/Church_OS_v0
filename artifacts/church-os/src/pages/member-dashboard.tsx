import { useAuth } from "@/components/auth-context";
import MemberLayout from "@/components/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Users, BadgeDollarSign, CalendarDays } from "lucide-react";

export default function MemberDashboard() {
  const { user } = useAuth();

  return (
    <MemberLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Your personal portal for {user?.churchName ?? "your church"}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/50 shadow-sm">
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
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
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

          <Card className="border-border/50 shadow-sm">
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
              <Button variant="outline" className="w-full mt-4" disabled>
                Give Now
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
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
    </MemberLayout>
  );
}

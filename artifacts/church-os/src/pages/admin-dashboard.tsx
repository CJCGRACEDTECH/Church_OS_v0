import { useAuth } from "@/components/auth-context";
import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const METRIC_CARDS = [
  { label: "Total Members", value: "247", trend: "+4 this week" },
  { label: "Avg Attendance", value: "189", trend: "+12% vs last month" },
  { label: "Children Check-In", value: "43", trend: "Last Sunday" },
  { label: "Giving YTD", value: "$12,450", trend: "On track" },
];

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at {user?.churchName ?? "your church"} today.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {METRIC_CARDS.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EmptyState
            icon={CalendarDays}
            title="Upcoming Services"
            description="Service scheduling and planning features are coming soon to Church OS."
            action={
              <Button variant="outline" disabled>
                Configure Services
              </Button>
            }
          />
          <EmptyState
            icon={Users}
            title="Recent Activity"
            description="Member activity streams and notifications are coming soon."
          />
        </div>
      </div>
    </AdminLayout>
  );
}

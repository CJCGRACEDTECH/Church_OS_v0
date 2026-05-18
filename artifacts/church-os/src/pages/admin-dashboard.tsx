import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-context";
import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/StatCard";
import EventsFeed from "@/components/EventsFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { apiJson, dollars, labelize, type Donation, type GivingCampaign, type GivingSummary } from "@/lib/giving";
import { Activity, HeartHandshake, Megaphone, UserPlus, Users } from "lucide-react";

type MemberSummary = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  memberStatus: "visitor" | "member" | "active_member" | "inactive";
  ministryDepartment: string | null;
  baptismStatus: string;
  servingStatus: string;
  createdAt: string;
};

type AttendanceSummary = {
  totalToday: number;
  activeSessions: number;
  weeklyAttendance: number;
  discipleshipAttendance: number;
  membersPresent: number;
  visitorsCount: number;
};

type ChildSummary = {
  id: number;
  checkinStatus: "checked_in" | "checked_out";
  classroom: string | null;
};

type SettingsResponse = {
  settings: {
    giving?: {
      givingGoals?: Record<string, number>;
    };
  };
};

const DEFAULT_GIVING_GOALS: Record<string, number> = {
  tithe: 100000,
  offering: 25000,
  building_fund: 75000,
  missions: 18000,
  special_campaign: 25000,
  other: 5000,
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const permissions = user?.adminPermissions ?? [];
  const canSeeGiving = hasPermission("admin", PERMISSIONS.GIVING_MANAGEMENT, permissions);
  const canSeeMembers = hasPermission("admin", PERMISSIONS.MEMBER_DIRECTORY, permissions);
  const canSeeAttendance = hasPermission("admin", PERMISSIONS.ATTENDANCE_MANAGEMENT, permissions);
  const canSeeChildren = hasPermission("admin", PERMISSIONS.ATTENDANCE_CHECKIN, permissions);
  const canSeeSettings = hasPermission("admin", PERMISSIONS.SYSTEM_SETTINGS, permissions);

  const campaignsQuery = useQuery({
    queryKey: ["dashboard-campaigns"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/admin/giving/campaigns"),
    enabled: canSeeGiving,
  });
  const givingSummaryQuery = useQuery({
    queryKey: ["dashboard-giving-summary"],
    queryFn: () => apiJson<GivingSummary>("/admin/giving/summary"),
    enabled: canSeeGiving,
  });
  const donationsQuery = useQuery({
    queryKey: ["dashboard-donations", new Date().getFullYear()],
    queryFn: () => apiJson<{ donations: Donation[] }>(`/admin/giving/donations?year=${new Date().getFullYear()}`),
    enabled: canSeeGiving,
  });
  const membersQuery = useQuery({
    queryKey: ["dashboard-members"],
    queryFn: () => apiJson<{ members: MemberSummary[] }>("/admin/members"),
    enabled: canSeeMembers,
  });
  const attendanceQuery = useQuery({
    queryKey: ["dashboard-attendance-summary"],
    queryFn: () => apiJson<AttendanceSummary>("/admin/attendance/summary"),
    enabled: canSeeAttendance,
  });
  const childrenQuery = useQuery({
    queryKey: ["dashboard-children-summary"],
    queryFn: () => apiJson<{ children: ChildSummary[] }>("/admin/checkin/children"),
    enabled: canSeeChildren,
  });
  const settingsQuery = useQuery({
    queryKey: ["dashboard-settings-goals"],
    queryFn: () => apiJson<SettingsResponse>("/admin/settings"),
    enabled: canSeeSettings,
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const donations = donationsQuery.data?.donations ?? [];
  const members = membersQuery.data?.members ?? [];
  const children = childrenQuery.data?.children ?? [];
  const givingGoals = settingsQuery.data?.settings.giving?.givingGoals ?? DEFAULT_GIVING_GOALS;
  const newMembersThisMonth = members.filter((member) => {
    const createdAt = new Date(member.createdAt);
    const now = new Date();
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  }).length;
  const visitors = members.filter((member) => member.memberStatus === "visitor").length;
  const activeMembers = members.filter((member) => member.memberStatus === "active_member").length;
  const checkedInChildren = children.filter((child) => child.checkinStatus === "checked_in").length;

  const metricCards = [
    { label: "Members", value: canSeeMembers ? String(members.length) : "-", trend: `${visitors} visitors` },
    { label: "Attendance Today", value: canSeeAttendance ? String(attendanceQuery.data?.totalToday ?? 0) : "-", trend: `${attendanceQuery.data?.activeSessions ?? 0} active sessions` },
    { label: "Children Ministry", value: canSeeChildren ? String(checkedInChildren) : "-", trend: `${children.length} children registered` },
    { label: "Giving YTD", value: canSeeGiving ? dollars(givingSummaryQuery.data?.totalYearCents ?? 0) : "-", trend: `${givingSummaryQuery.data?.activeCampaigns ?? 0} active campaigns` },
  ];

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
          {metricCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EventsFeed detailBasePath="/admin/services" />
          <CampaignsCard campaigns={activeCampaigns} isLoading={campaignsQuery.isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GivingGoalsCard donations={donations} goals={givingGoals} canSeeGiving={canSeeGiving} />
          <RecentActivitySummary
            activeMembers={activeMembers}
            visitors={visitors}
            newMembersThisMonth={newMembersThisMonth}
            attendance={attendanceQuery.data}
            checkedInChildren={checkedInChildren}
            totalChildren={children.length}
            canSeeMembers={canSeeMembers}
            canSeeAttendance={canSeeAttendance}
            canSeeChildren={canSeeChildren}
          />
        </div>
      </div>
    </AdminLayout>
  );
}

function CampaignsCard({ campaigns, isLoading }: { campaigns: GivingCampaign[]; isLoading: boolean }) {
  const featured = campaigns.slice(0, 3);
  const totalRaised = campaigns.reduce((sum, campaign) => sum + campaign.amountRaisedCents, 0);
  const totalGoal = campaigns.reduce((sum, campaign) => sum + campaign.goalAmountCents, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Campaigns
          </CardTitle>
          <CardDescription>Active giving campaigns and current progress.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/giving">Manage</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading campaigns...</p>}
        {!isLoading && !featured.length && (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No active campaigns yet. Create one from Giving.
          </div>
        )}
        {!!featured.length && (
          <>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">All Active Campaigns</span>
                <Badge variant="secondary">{campaigns.length}</Badge>
              </div>
              <p className="mt-2 text-2xl font-semibold">{dollars(totalRaised)}</p>
              <p className="text-xs text-muted-foreground">raised of {dollars(totalGoal)}</p>
            </div>
            <div className="space-y-3">
              {featured.map((campaign) => (
                <div key={campaign.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{campaign.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{campaign.campaignCategory ?? labelize(campaign.status)}</p>
                    </div>
                    <Badge variant="outline">{campaign.progressPercent}%</Badge>
                  </div>
                  <Progress className="mt-3" value={campaign.progressPercent} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dollars(campaign.amountRaisedCents)} raised of {dollars(campaign.goalAmountCents)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GivingGoalsCard({ donations, goals, canSeeGiving }: { donations: Donation[]; goals: Record<string, number>; canSeeGiving: boolean }) {
  const categories = Object.entries(goals);
  const succeeded = donations.filter((donation) => donation.paymentStatus === "succeeded");
  const totals = succeeded.reduce<Record<string, number>>((acc, donation) => {
    acc[donation.givingCategory] = (acc[donation.givingCategory] ?? 0) + donation.amountCents;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5" /> Giving Goals</CardTitle>
          <CardDescription>Tithes, offerings, and category goals for the current year.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/settings?section=giving">Goals</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canSeeGiving && <p className="text-sm text-muted-foreground">Giving permissions are required to view goal progress.</p>}
        {canSeeGiving && categories.map(([category, goal]) => {
          const raised = totals[category] ?? 0;
          const goalCents = Math.max(0, Math.round(Number(goal) * 100));
          const progress = goalCents > 0 ? Math.min(100, Math.round((raised / goalCents) * 100)) : 0;
          return (
            <div key={category} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{labelize(category)}</p>
                  <p className="text-xs text-muted-foreground">{dollars(raised)} raised of {dollars(goalCents)}</p>
                </div>
                <Badge variant="outline">{progress}%</Badge>
              </div>
              <Progress className="mt-3" value={progress} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RecentActivitySummary({
  activeMembers,
  visitors,
  newMembersThisMonth,
  attendance,
  checkedInChildren,
  totalChildren,
  canSeeMembers,
  canSeeAttendance,
  canSeeChildren,
}: {
  activeMembers: number;
  visitors: number;
  newMembersThisMonth: number;
  attendance?: AttendanceSummary;
  checkedInChildren: number;
  totalChildren: number;
  canSeeMembers: boolean;
  canSeeAttendance: boolean;
  canSeeChildren: boolean;
}) {
  const rows = [
    { label: "New members this month", value: canSeeMembers ? String(newMembersThisMonth) : "-", detail: "Recently added profiles", icon: UserPlus },
    { label: "Visitors", value: canSeeMembers ? String(visitors) : "-", detail: `${activeMembers} active members`, icon: Users },
    { label: "Attendance today", value: canSeeAttendance ? String(attendance?.totalToday ?? 0) : "-", detail: `${attendance?.weeklyAttendance ?? 0} present records`, icon: Activity },
    { label: "Children checked in", value: canSeeChildren ? String(checkedInChildren) : "-", detail: `${totalChildren} registered children`, icon: Users },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Activity</CardTitle>
        <CardDescription>Live summaries from members, attendance, and children ministry.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <row.icon className="h-4 w-4" />
              {row.label}
            </div>
            <p className="mt-2 text-2xl font-semibold">{row.value}</p>
            <p className="text-xs text-muted-foreground">{row.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

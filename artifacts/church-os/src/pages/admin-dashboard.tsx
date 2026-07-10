import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-context";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { apiJson, labelize, type GivingCampaign } from "@/lib/giving";
import { apiJson as eventsApiJson, eventTypeCalendarClasses, formatDateTimeRange, labelize as eventLabelize, type ChurchEvent } from "@/lib/events";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bell,
  CalendarDays,
  Expand,
  Info,
  LayoutDashboard,
  Smile,
  Users,
  Video,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type DashboardSummary = {
  totalMembers: number;
  activeMembers: number;
  newMembersLast30Days: number;
  visitors: number;
  givingMtdCents: number;
  givingYtdCents: number;
  givingMonthlyGoalCents: number;
  givingMonthlyGoalPercent: number;
  activeCampaigns: number;
  checkedInChildren: number;
  totalChildren: number;
  childrenMinistryAttendance?: {
    averageCheckedIn: number;
    attendanceRate: number;
    latestCheckedIn: number;
    totalRegistered: number;
  };
  attendanceRateLast4: number | null;
  attendanceTrend: Array<{
    sessionName: string;
    sessionDate: string;
    attendanceType: string;
    present: number;
    memberCount: number;
  }>;
  givingTrend: Array<{ sessionName: string; sessionDate: string; totalCents: number }>;
  regularServiceAttendance: {
    averagePerSession: number;
    averageAttendanceRate?: number;
    latestSessionCount: number;
    last8Sessions: Array<{
      sessionId: number;
      sessionName: string;
      sessionDate: string;
      attendeeCount: number;
      memberCount?: number;
      attendanceRate?: number;
      breakdown?: { activeMember: number; member: number; visitor: number };
    }>;
  };
  discipleshipAttendance: {
    totalTaggedDisciples: number;
    latestCheckedIn: number;
    latestAttendanceRate: number;
    averagePerSession: number;
    last8Sessions: Array<{ sessionId: number; sessionName: string; sessionDate: string; checkedInDisciples: number; totalTaggedDisciples: number; attendanceRate: number }>;
  };
  givingByService: {
    last8RegularServices: Array<{
      sessionId: number;
      sessionName: string;
      sessionDate: string;
      serviceDate?: string;
      totalGiving: number;
      tithe: number;
      giftOffering: number;
      buildingFund: number;
    }>;
  };
  recentNewMembers: Array<{
    id: number;
    firstName: string;
    lastName: string;
    memberStatus: string | null;
    ministryDepartment: string | null;
    createdAt: string;
  }>;
};

type ActivityLogEntry = {
  type: string;
  label: string;
  detail: string;
  status: string;
  timestamp: string | null;
};

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function memberStatusColor(status: string | null) {
  if (status === "active_member") return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200";
  if (status === "member") return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200";
  if (status === "visitor") return "bg-white text-yellow-700 dark:text-yellow-400 border-yellow-200";
  return "bg-muted text-muted-foreground";
}

function compactDollars(cents: number) {
  const amount = cents / 100;
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const permissions = user?.adminPermissions ?? [];
  const canSeeGiving = hasPermission("admin", PERMISSIONS.GIVING_MANAGEMENT, permissions);
  const canSeeMembers = hasPermission("admin", PERMISSIONS.MEMBER_DIRECTORY, permissions);
  const canSeeAttendance = hasPermission("admin", PERMISSIONS.ATTENDANCE_MANAGEMENT, permissions);
  const canSeeChildren = hasPermission("admin", PERMISSIONS.ATTENDANCE_CHECKIN, permissions);
  const canSeeEvents = hasPermission("admin", PERMISSIONS.EVENT_MANAGEMENT, permissions);
  const isSuperAdmin = user?.adminLevel === "super_admin";
  const isChildrenMinistryOnly = permissions.length === 1 && permissions.includes(PERMISSIONS.ATTENDANCE_CHECKIN);

  React.useEffect(() => {
    if (isChildrenMinistryOnly) setLocation("/admin/check-in");
  }, [isChildrenMinistryOnly, setLocation]);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", "children-ministry-kpi-v2"],
    queryFn: () => apiJson<DashboardSummary>("/admin/dashboard/summary", { cache: "no-store" }),
    enabled: !isChildrenMinistryOnly,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const campaignsQuery = useQuery({
    queryKey: ["dashboard-campaigns"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/admin/giving/campaigns"),
    enabled: canSeeGiving,
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard-activity-log"],
    queryFn: () => apiJson<{ log: ActivityLogEntry[] }>("/admin/activity-log"),
    enabled: !isChildrenMinistryOnly,
  });

  const summary = summaryQuery.data;
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const legacyRegularTrend = summary?.attendanceTrend
    ?.filter((session) => session.attendanceType === "regular_service")
    .map((session, index) => ({
      sessionId: index,
      sessionName: session.sessionName,
      sessionDate: session.sessionDate,
      attendeeCount: session.present,
      breakdown: { activeMember: session.present, member: 0, visitor: 0 },
    })) ?? [];
  const legacyDiscipleshipTrend = summary?.attendanceTrend
    ?.filter((session) => session.attendanceType === "discipleship")
    .map((session, index) => ({
      sessionId: index,
      sessionName: session.sessionName,
      sessionDate: session.sessionDate,
      checkedInDisciples: session.present,
      totalTaggedDisciples: session.memberCount,
      attendanceRate: session.memberCount > 0 ? Math.round((session.present / session.memberCount) * 100) : 0,
    })) ?? [];
  const regularAttendance = summary?.regularServiceAttendance ?? {
    averagePerSession: legacyRegularTrend.length
      ? Math.round(legacyRegularTrend.reduce((sum, session) => sum + session.attendeeCount, 0) / legacyRegularTrend.length)
      : 0,
    averageAttendanceRate: summary?.totalMembers && legacyRegularTrend.length
      ? Math.round((Math.round(legacyRegularTrend.reduce((sum, session) => sum + session.attendeeCount, 0) / legacyRegularTrend.length) / summary.totalMembers) * 100)
      : 0,
    latestSessionCount: legacyRegularTrend.at(-1)?.attendeeCount ?? 0,
    last8Sessions: legacyRegularTrend.map((session) => ({
      ...session,
      memberCount: summary?.totalMembers ?? 0,
      attendanceRate: summary?.totalMembers ? Math.round((session.attendeeCount / summary.totalMembers) * 100) : 0,
    })),
  };
  const discipleshipAttendance = summary?.discipleshipAttendance ?? {
    totalTaggedDisciples: legacyDiscipleshipTrend.at(-1)?.totalTaggedDisciples ?? 0,
    latestCheckedIn: legacyDiscipleshipTrend.at(-1)?.checkedInDisciples ?? 0,
    latestAttendanceRate: legacyDiscipleshipTrend.at(-1)?.attendanceRate ?? 0,
    averagePerSession: legacyDiscipleshipTrend.length
      ? Math.round(legacyDiscipleshipTrend.reduce((sum, session) => sum + session.checkedInDisciples, 0) / legacyDiscipleshipTrend.length)
      : 0,
    last8Sessions: legacyDiscipleshipTrend,
  };
  const givingTrend = summary?.givingByService?.last8RegularServices
    ?? summary?.givingTrend?.map((session, index) => ({
      sessionId: index,
      sessionName: session.sessionName,
      sessionDate: session.sessionDate,
      serviceDate: session.sessionDate.slice(0, 10),
      totalGiving: session.totalCents,
      tithe: 0,
      giftOffering: 0,
      buildingFund: 0,
    }))
    ?? [];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <PageHeader
          eyebrow="Overview"
          title={`Welcome back, ${user?.firstName ?? ""}`}
          description={`Here's what's happening at ${user?.churchName ?? "your church"} today.`}
          icon={<LayoutDashboard className="h-6 w-6" />}
          actions={
            <DashboardNotificationsButton
              log={activityQuery.data?.log ?? []}
              members={summary?.recentNewMembers ?? []}
              activityLoading={activityQuery.isLoading}
              activityError={activityQuery.isError}
              membersLoading={summaryQuery.isLoading}
              membersError={summaryQuery.isError}
              canSeeActivity={isSuperAdmin}
              canSeeMembers={canSeeMembers}
            />
          }
        />

        {(canSeeMembers || canSeeGiving) && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
            {canSeeMembers && (
              <MemberOverviewCard
                totalMembers={summary?.totalMembers ?? 0}
                activeMembers={summary?.activeMembers ?? 0}
                visitors={summary?.visitors ?? 0}
                newMembersLast30Days={summary?.newMembersLast30Days ?? 0}
                isLoading={summaryQuery.isLoading}
                isError={summaryQuery.isError}
              />
            )}
            {canSeeGiving && (
              <GivingOverviewCard
                givingMtdCents={summary?.givingMtdCents ?? 0}
                givingYtdCents={summary?.givingYtdCents ?? 0}
                givingMonthlyGoalCents={summary?.givingMonthlyGoalCents ?? 0}
                givingMonthlyGoalPercent={summary?.givingMonthlyGoalPercent ?? 0}
                activeCampaigns={activeCampaigns}
                isLoading={summaryQuery.isLoading || campaignsQuery.isLoading}
                isError={summaryQuery.isError || campaignsQuery.isError}
              />
            )}
          </div>
        )}

        {(canSeeAttendance || canSeeChildren) && (
          <AttendanceOverviewCard
            regular={summary ? regularAttendance : undefined}
            discipleship={summary ? discipleshipAttendance : undefined}
            totalChildren={summary?.totalChildren ?? 0}
            checkedInChildren={summary?.checkedInChildren ?? 0}
            childrenMinistry={summary?.childrenMinistryAttendance}
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            canSeeAttendance={canSeeAttendance}
            canSeeChildren={canSeeChildren}
          />
        )}

        {(canSeeEvents || canSeeAttendance || canSeeGiving) && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] gap-4">
            {(canSeeAttendance || canSeeGiving) && (
              <div className="space-y-4">
                {canSeeAttendance && (
                  <AttendanceTrendCard
                    regularTrend={summary ? regularAttendance.last8Sessions : []}
                    discipleshipTrend={summary ? discipleshipAttendance.last8Sessions : []}
                    isLoading={summaryQuery.isLoading}
                    isError={summaryQuery.isError}
                    canSee={canSeeAttendance}
                    canExpand={isSuperAdmin}
                  />
                )}
                {canSeeGiving && (
                  <GivingTrendCard
                    trend={summary ? givingTrend : []}
                    isLoading={summaryQuery.isLoading}
                    isError={summaryQuery.isError}
                    canSee={canSeeGiving}
                    canExpand={isSuperAdmin}
                  />
                )}
              </div>
            )}
            {canSeeEvents && <AdminUpcomingEventsCard />}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}

function DashboardNotificationsButton({
  log,
  members,
  activityLoading,
  activityError,
  membersLoading,
  membersError,
  canSeeActivity,
  canSeeMembers,
}: {
  log: ActivityLogEntry[];
  members: DashboardSummary["recentNewMembers"];
  activityLoading: boolean;
  activityError: boolean;
  membersLoading: boolean;
  membersError: boolean;
  canSeeActivity: boolean;
  canSeeMembers: boolean;
}) {
  const notificationCount = (canSeeActivity ? log.length : 0) + (canSeeMembers ? members.length : 0);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative w-fit">
          <Bell className="mr-2 h-4 w-4" />
          Notifications
          {notificationCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[82vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </DialogTitle>
          <DialogDescription>Recent activity, new members, and visitors.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {canSeeActivity && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Recent Activity</p>
                  <p className="text-xs text-muted-foreground">Admin logins and invitations</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/settings?tab=admins">Manage</Link>
                </Button>
              </div>
              {activityLoading && <SkeletonList rows={4} />}
              {activityError && <EmptyState message="Could not load activity." isError />}
              {!activityLoading && !activityError && log.length === 0 && <EmptyState message="No recent activity recorded." />}
              {!activityLoading && !activityError && log.slice(0, 8).map((entry, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md border p-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.detail}</p>
                    {entry.timestamp && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs capitalize">{entry.status}</Badge>
                </div>
              ))}
            </div>
          )}

          {canSeeMembers && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">New Members & Visitors</p>
                  <p className="text-xs text-muted-foreground">Profiles added in the last 30 days</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/members">View All</Link>
                </Button>
              </div>
              {membersLoading && <SkeletonList rows={4} />}
              {membersError && <EmptyState message="Could not load new members." isError />}
              {!membersLoading && !membersError && members.length === 0 && <EmptyState message="No new members or visitors in the last 30 days." />}
              {!membersLoading && !membersError && members.slice(0, 8).map((member) => (
                <Link key={member.id} href={`/admin/members/${member.id}`}>
                  <div className="rounded-md border p-3 transition-all hover:border-primary/30 hover:shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(member.firstName, member.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.firstName} {member.lastName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${memberStatusColor(member.memberStatus)}`}>
                        {labelize(member.memberStatus ?? "unknown")}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberOverviewCard({
  totalMembers,
  activeMembers,
  visitors,
  newMembersLast30Days,
  isLoading,
  isError,
}: {
  totalMembers: number;
  activeMembers: number;
  visitors: number;
  newMembersLast30Days: number;
  isLoading: boolean;
  isError: boolean;
}) {
  const regularMembers = Math.max(totalMembers - activeMembers, 0);
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Members
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/members">Member Directory</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <SkeletonList rows={3} />}
        {isError && <EmptyState message="Could not load member summary." isError />}
        {!isLoading && !isError && (
          <div className="grid h-full gap-4 sm:grid-cols-[minmax(135px,0.75fr)_minmax(0,1.25fr)] sm:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Members</p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-slate-950">{totalMembers}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-emerald-700">+{newMembersLast30Days} MoM Growth</span>
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MemberBreakdownMetric
                label="Active"
                value={activeMembers}
                tooltip="Serving or attending more than 50% of monthly service sessions."
                className="border-emerald-200 bg-emerald-50 text-emerald-900"
                labelClassName="text-emerald-700"
              />
              <MemberBreakdownMetric
                label="Members"
                value={regularMembers}
                tooltip="Member profiles that are not currently active by serving or attendance logic."
                className="border-blue-200 bg-blue-50 text-blue-900"
                labelClassName="text-blue-700"
              />
              <MemberBreakdownMetric
                label="Visitors"
                value={visitors}
                tooltip="Visitor profiles are tracked separately and are not counted in Total Members."
                className="border-amber-200 bg-white text-slate-900"
                labelClassName="text-amber-700"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberBreakdownMetric({
  label,
  value,
  tooltip,
  className,
  labelClassName,
}: {
  label: string;
  value: number;
  tooltip: string;
  className: string;
  labelClassName: string;
}) {
  return (
    <div className={`rounded-md border p-3 ${className}`}>
      <div className="flex items-center gap-1.5">
        <p className={`text-xs font-medium ${labelClassName}`}>{label}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className={`${labelClassName} opacity-70 transition-opacity hover:opacity-100`}>
              <Info className="h-3.5 w-3.5" />
              <span className="sr-only">{label} details</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-52">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function GivingOverviewCard({
  givingMtdCents,
  givingYtdCents,
  givingMonthlyGoalCents,
  givingMonthlyGoalPercent,
  activeCampaigns,
  isLoading,
  isError,
}: {
  givingMtdCents: number;
  givingYtdCents: number;
  givingMonthlyGoalCents: number;
  givingMonthlyGoalPercent: number;
  activeCampaigns: GivingCampaign[];
  isLoading: boolean;
  isError: boolean;
}) {
  const totalRaised = activeCampaigns.reduce((sum, campaign) => sum + campaign.amountRaisedCents, 0);
  const totalGoal = activeCampaigns.reduce((sum, campaign) => sum + campaign.goalAmountCents, 0);
  const progressPercent = totalGoal > 0 ? Math.min(Math.round((totalRaised / totalGoal) * 100), 100) : 0;
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5" /> Giving
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/giving">Open Giving</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <SkeletonList rows={3} />}
        {isError && <EmptyState message="Could not load giving summary." isError />}
        {!isLoading && !isError && (
          <div className="grid h-full gap-3 sm:grid-cols-2">
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Giving MTD</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-800">{compactDollars(givingMtdCents)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Giving YTD</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{compactDollars(givingYtdCents)}</p>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Monthly Goal</p>
                <Badge variant="secondary">{givingMonthlyGoalPercent}%</Badge>
              </div>
              <Progress className="mt-3" value={Math.min(givingMonthlyGoalPercent, 100)} />
              <p className="mt-2 text-xs text-muted-foreground">
                {compactDollars(givingMtdCents)} of {givingMonthlyGoalCents > 0 ? compactDollars(givingMonthlyGoalCents) : "No goal"}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Active Campaigns</p>
                <Badge variant="secondary">{activeCampaigns.length}</Badge>
              </div>
              <Progress className="mt-3" value={progressPercent} />
              <p className="mt-2 text-xs text-muted-foreground">
                {compactDollars(totalRaised)} raised of {compactDollars(totalGoal)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceOverviewCard({
  regular,
  discipleship,
  totalChildren,
  checkedInChildren,
  childrenMinistry,
  isLoading,
  isError,
  canSeeAttendance,
  canSeeChildren,
}: {
  regular: DashboardSummary["regularServiceAttendance"] | undefined;
  discipleship: DashboardSummary["discipleshipAttendance"] | undefined;
  totalChildren: number;
  checkedInChildren: number;
  childrenMinistry: DashboardSummary["childrenMinistryAttendance"] | undefined;
  isLoading: boolean;
  isError: boolean;
  canSeeAttendance: boolean;
  canSeeChildren: boolean;
}) {
  const canSeeChildrenMetrics = canSeeChildren || canSeeAttendance;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Attendance Overview
          </CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeAttendance && (
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/attendance">Attendance</Link>
            </Button>
          )}
          {canSeeChildren && (
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/check-in">Children</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <SkeletonList rows={3} />}
        {isError && <EmptyState message="Could not load attendance overview." isError />}
        {!isLoading && !isError && (
          <div className="grid gap-3 md:grid-cols-3">
            {canSeeAttendance && (
              <div className="rounded-md border bg-blue-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-blue-950">Service Attendance</p>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-blue-700">Service average</p>
                <p className="text-3xl font-bold text-blue-950">{regular?.averagePerSession ?? 0}</p>
                <p className="mt-1 text-xs text-blue-700">
                  {regular?.averageAttendanceRate ?? 0}% avg attendance rate
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Latest: {regular?.latestSessionCount ?? 0}
                </p>
              </div>
            )}

            {canSeeAttendance && (
              <div className="rounded-md border bg-indigo-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-indigo-950">Discipleship</p>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-700">Discipleship average</p>
                <p className="text-3xl font-bold text-indigo-950">
                  {discipleship?.averagePerSession ?? 0}
                </p>
                <p className="mt-1 text-xs text-indigo-700">
                  {discipleship?.totalTaggedDisciples
                    ? Math.round(((discipleship?.averagePerSession ?? 0) / discipleship.totalTaggedDisciples) * 100)
                    : 0}% avg attendance rate
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Latest: {discipleship?.latestCheckedIn ?? 0}/{discipleship?.totalTaggedDisciples ?? 0}
                </p>
              </div>
            )}

            {canSeeChildrenMetrics && (
              <div className="rounded-md border bg-cyan-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-cyan-950">Children Ministry</p>
                  <Smile className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-cyan-700">Children average</p>
                <p className="text-3xl font-bold text-cyan-950">{childrenMinistry?.averageCheckedIn ?? 0}</p>
                <p className="mt-1 text-xs text-cyan-700">
                  {childrenMinistry?.attendanceRate ?? 0}% avg attendance rate
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Latest: {childrenMinistry?.latestCheckedIn ?? 0}/{childrenMinistry?.totalRegistered ?? totalChildren}
                </p>
              </div>
            )}

            {!canSeeAttendance && !canSeeChildren && (
              <div className="md:col-span-3">
                <EmptyState message="Attendance permissions required to view this overview." />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function AttendanceTrendCard({
  regularTrend,
  discipleshipTrend,
  isLoading,
  isError,
  canSee,
  canExpand,
}: {
  regularTrend: DashboardSummary["regularServiceAttendance"]["last8Sessions"];
  discipleshipTrend: DashboardSummary["discipleshipAttendance"]["last8Sessions"];
  isLoading: boolean;
  isError: boolean;
  canSee: boolean;
  canExpand: boolean;
}) {
  const [viewType, setViewType] = React.useState<"regular_service" | "discipleship">("regular_service");
  const filteredRegularTrend = viewType === "regular_service" ? regularTrend : [];
  const filteredDiscipleshipTrend = viewType === "discipleship" ? discipleshipTrend : [];
  const filteredTrendCount = viewType === "regular_service" ? filteredRegularTrend.length : filteredDiscipleshipTrend.length;
  const maxCount = viewType === "regular_service"
    ? Math.max(...filteredRegularTrend.map((session) => session.attendeeCount), 1)
    : Math.max(...filteredDiscipleshipTrend.map((session) => session.checkedInDisciples), 1);
  const yTicks = [maxCount, Math.round(maxCount * 0.75), Math.round(maxCount * 0.5), Math.round(maxCount * 0.25), 0];
  const regularBreakdown = (session: DashboardSummary["regularServiceAttendance"]["last8Sessions"][number]) =>
    session.breakdown ?? { activeMember: session.attendeeCount, member: 0, visitor: 0 };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Attendance Rate Trend
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {canExpand && filteredTrendCount > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Expand className="mr-2 h-4 w-4" /> Expand</Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>Attendance Rate Trend</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">View</p><p className="text-lg font-semibold">{viewType === "regular_service" ? "Regular Service" : "Discipleship"}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Average Count</p><p className="text-lg font-semibold">{viewType === "regular_service" ? Math.round(filteredRegularTrend.reduce((sum, s) => sum + s.attendeeCount, 0) / Math.max(filteredRegularTrend.length, 1)) : Math.round(filteredDiscipleshipTrend.reduce((sum, s) => sum + s.checkedInDisciples, 0) / Math.max(filteredDiscipleshipTrend.length, 1))}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Sessions</p><p className="text-lg font-semibold">{filteredTrendCount}</p></div>
                </div>
                <div className="mt-4 flex h-72 items-end gap-3 rounded-md border p-4">
                  {(viewType === "regular_service" ? filteredRegularTrend : filteredDiscipleshipTrend).map((session, i) => {
                    const count = viewType === "regular_service" ? "attendeeCount" in session ? session.attendeeCount : 0 : "checkedInDisciples" in session ? session.checkedInDisciples : 0;
                    const pct = Math.max(Math.round((count / maxCount) * 100), count > 0 ? 3 : 0);
                    const dateLabel = new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const tooltipDate = new Date(session.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                    const breakdown = "attendeeCount" in session ? regularBreakdown(session) : null;
                    return (
                      <div key={`${session.sessionId}-${i}`} className="group relative flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-56 w-full items-end">
                          {breakdown ? (
                            <div className="flex w-full flex-col overflow-hidden rounded-t-md" style={{ height: `${pct}%` }}>
                              <div className="bg-[#0f2a4a]" style={{ height: `${count > 0 ? (breakdown.activeMember / count) * 100 : 0}%` }} />
                              <div className="bg-[#2563eb]" style={{ height: `${count > 0 ? (breakdown.member / count) * 100 : 0}%` }} />
                              <div className="bg-[#bfdbfe]" style={{ height: `${count > 0 ? (breakdown.visitor / count) * 100 : 0}%` }} />
                            </div>
                          ) : (
                            <div className="w-full rounded-t-md bg-[#2563eb]" style={{ height: `${pct}%` }} />
                          )}
                        </div>
                        <div className="text-center"><p className="text-xs font-medium">{count}</p><p className="text-[10px] text-muted-foreground">{dateLabel}</p></div>
                        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap rounded border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:flex">
                          <span className="font-semibold">{session.sessionName}</span>
                          <span className="text-muted-foreground">{tooltipDate}</span>
                          {breakdown ? (
                            <>
                              <span className="font-medium text-foreground">{count} attended</span>
                              <span className="text-muted-foreground">{breakdown.activeMember} active · {breakdown.member} members · {breakdown.visitor} visitors</span>
                            </>
                          ) : (
                            <span className="font-medium text-foreground">{count} / {"totalTaggedDisciples" in session ? session.totalTaggedDisciples : 0}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/attendance">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 inline-flex rounded-md border p-1">
          <button
            type="button"
            onClick={() => setViewType("regular_service")}
            className={`rounded px-2 py-1 text-xs ${viewType === "regular_service" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Service
          </button>
          <button
            type="button"
            onClick={() => setViewType("discipleship")}
            className={`rounded px-2 py-1 text-xs ${viewType === "discipleship" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Discipleship
          </button>
        </div>
        {!canSee && <EmptyState message="Attendance permissions required to view trend." />}
        {canSee && isLoading && (
          <div className="flex items-end gap-1.5 h-28 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-muted animate-pulse"
                style={{ height: `${30 + (i % 3) * 20}%` }}
              />
            ))}
          </div>
        )}
        {canSee && isError && <EmptyState message="Could not load attendance trend." isError />}
        {canSee && !isLoading && !isError && filteredTrendCount === 0 && (
          <EmptyState
            message="No attendance sessions recorded yet."
            actionHref="/admin/attendance"
            actionLabel="Record Attendance"
          />
        )}
        {canSee && !isLoading && !isError && filteredTrendCount > 0 && (
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-5">
                {yTicks.map((count, index) => (
                  <div key={`${count}-${index}`} className="flex items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground/60 w-6 text-right shrink-0">{count}</span>
                    <div className="flex-1 border-t border-dashed border-muted-foreground/15" />
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-1.5 h-32 pl-7">
                {viewType === "regular_service" && filteredRegularTrend.map((session, i) => {
                  const presentCount = session.attendeeCount;
                  const memberCount = session.memberCount ?? 0;
                  const ratePct = session.attendanceRate ?? (memberCount > 0 ? Math.round((presentCount / memberCount) * 100) : 0);
                  const barPct = Math.max(Math.round((presentCount / maxCount) * 100), presentCount > 0 ? 3 : 0);
                  const breakdown = regularBreakdown(session);
                  const label = new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const tooltipDate = new Date(session.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                      <div className="w-full flex flex-col justify-end h-24 relative">
                        <div className="absolute bottom-0 flex w-full flex-col overflow-hidden rounded-t-sm transition-opacity" style={{ height: `${barPct}%` }}>
                          <div className="bg-[#0f2a4a]" style={{ height: `${presentCount > 0 ? (breakdown.activeMember / presentCount) * 100 : 0}%` }} />
                          <div className="bg-[#2563eb]" style={{ height: `${presentCount > 0 ? (breakdown.member / presentCount) * 100 : 0}%` }} />
                          <div className="bg-[#bfdbfe]" style={{ height: `${presentCount > 0 ? (breakdown.visitor / presentCount) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">{label}</span>
                      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-popover text-popover-foreground text-xs rounded px-2.5 py-1.5 shadow-md border whitespace-nowrap z-10 flex-col items-center gap-0.5">
                        <span className="font-semibold">{session.sessionName}</span>
                        <span className="text-muted-foreground">{tooltipDate}</span>
                        <span className="font-medium text-foreground">{presentCount} attended</span>
                        <span className="text-muted-foreground">{breakdown.activeMember} active · {breakdown.member} members · {breakdown.visitor} visitors</span>
                        <span className="text-muted-foreground">{ratePct}% attendance rate</span>
                      </div>
                    </div>
                  );
                })}
                {viewType === "discipleship" && filteredDiscipleshipTrend.map((session, i) => {
                  const presentCount = session.checkedInDisciples;
                  const denominator = Math.max(session.totalTaggedDisciples, 1);
                  const ratePct = Math.min(Math.round((presentCount / denominator) * 100), 100);
                  const barPct = Math.max(Math.round((presentCount / maxCount) * 100), presentCount > 0 ? 3 : 0);
                  const label = new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const tooltipDate = new Date(session.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                      <div className="w-full flex flex-col justify-end h-24 relative">
                        <div className="w-full rounded-t-sm absolute bottom-0 transition-opacity bg-[#2563eb]" style={{ height: `${barPct}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">{label}</span>
                      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-popover text-popover-foreground text-xs rounded px-2.5 py-1.5 shadow-md border whitespace-nowrap z-10 flex-col items-center gap-0.5">
                        <span className="font-semibold">{session.sessionName}</span>
                        <span className="text-muted-foreground">{tooltipDate}</span>
                        <span className="font-medium text-foreground">{presentCount} / {session.totalTaggedDisciples} — {ratePct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pl-7">
              {viewType === "regular_service" ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0f2a4a]" />Active</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563eb]" />Member</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#bfdbfe]" />Visitor</span>
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563eb]" />
                  Discipleship count
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GivingTrendCard({
  trend,
  isLoading,
  isError,
  canSee,
  canExpand,
}: {
  trend: DashboardSummary["givingByService"]["last8RegularServices"];
  isLoading: boolean;
  isError: boolean;
  canSee: boolean;
  canExpand: boolean;
}) {
  const maxCents = Math.max(...trend.map((t) => t.totalGiving), 1);
  const formatServiceDate = (session: { sessionDate: string; serviceDate?: string }) => {
    const [year, month, day] = (session.serviceDate ?? session.sessionDate.slice(0, 10)).split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5" /> Giving per Service
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {canExpand && trend.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Expand className="mr-2 h-4 w-4" /> Expand</Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>Giving per Service</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total Giving</p><p className="text-lg font-semibold">{compactDollars(trend.reduce((sum, s) => sum + s.totalGiving, 0))}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Tithe</p><p className="text-lg font-semibold">{compactDollars(trend.reduce((sum, s) => sum + s.tithe, 0))}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Gift/Offering</p><p className="text-lg font-semibold">{compactDollars(trend.reduce((sum, s) => sum + s.giftOffering, 0))}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Building Fund</p><p className="text-lg font-semibold">{compactDollars(trend.reduce((sum, s) => sum + s.buildingFund, 0))}</p></div>
                </div>
                <div className="mt-4 flex h-72 items-end gap-3 rounded-md border p-4">
                  {trend.map((session) => {
                    const pct = Math.max((session.totalGiving / maxCents) * 100, session.totalGiving > 0 ? 3 : 0);
                    const label = formatServiceDate(session).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <div key={session.sessionId} className="group relative flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-56 w-full items-end">
                          <div className="w-full overflow-hidden rounded-t-md" style={{ height: `${pct}%` }}>
                            <div className="bg-emerald-700" style={{ height: `${session.totalGiving > 0 ? (session.tithe / session.totalGiving) * 100 : 0}%` }} />
                            <div className="bg-emerald-500" style={{ height: `${session.totalGiving > 0 ? (session.giftOffering / session.totalGiving) * 100 : 0}%` }} />
                            <div className="bg-lime-500" style={{ height: `${session.totalGiving > 0 ? (session.buildingFund / session.totalGiving) * 100 : 0}%` }} />
                          </div>
                        </div>
                        <div className="text-center"><p className="text-xs font-medium">{compactDollars(session.totalGiving)}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
                        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap rounded border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:flex">
                          <span className="font-semibold">{session.sessionName}</span>
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-foreground">{compactDollars(session.totalGiving)} total</span>
                          <span className="text-muted-foreground">Tithe {compactDollars(session.tithe)} · Offering {compactDollars(session.giftOffering)} · Building {compactDollars(session.buildingFund)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/giving">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!canSee && <EmptyState message="Giving permissions required to view trend." />}
        {canSee && isLoading && (
          <div className="flex items-end gap-1.5 h-28 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-muted animate-pulse"
                style={{ height: `${20 + (i % 4) * 18}%` }}
              />
            ))}
          </div>
        )}
        {canSee && isError && <EmptyState message="Could not load giving trend." isError />}
        {canSee && !isLoading && !isError && trend.length === 0 && (
          <EmptyState
            message="No regular service sessions recorded yet."
            actionHref="/admin/attendance"
            actionLabel="Record Attendance"
          />
        )}
        {canSee && !isLoading && !isError && trend.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-end gap-1.5 h-28">
              {trend.map((session, i) => {
                const pct = (session.totalGiving / maxCents) * 100;
                const label = formatServiceDate(session).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                const tithePct = session.totalGiving > 0 ? (session.tithe / session.totalGiving) * 100 : 0;
                const offeringPct = session.totalGiving > 0 ? (session.giftOffering / session.totalGiving) * 100 : 0;
                const buildingPct = session.totalGiving > 0 ? (session.buildingFund / session.totalGiving) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div className="w-full flex flex-col justify-end h-24 relative">
                      {session.totalGiving > 0 ? (
                        <div className="w-full absolute bottom-0 overflow-hidden rounded-t-sm" style={{ height: `${Math.max(pct, 5)}%` }}>
                          <div className="bg-emerald-700" style={{ height: `${tithePct}%` }} />
                          <div className="bg-emerald-500" style={{ height: `${offeringPct}%` }} />
                          <div className="bg-lime-500" style={{ height: `${buildingPct}%` }} />
                        </div>
                      ) : (
                        <div className="w-full rounded-t-sm border border-dashed border-muted-foreground/30 absolute bottom-0 bg-muted/30" style={{ height: "8%" }} />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">
                      {label}
                    </span>
                    <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-popover text-popover-foreground text-xs rounded px-2.5 py-2 shadow border whitespace-nowrap z-10 flex-col items-start">
                      <span className="font-medium">{session.sessionName}</span>
                      <span>Total: {compactDollars(session.totalGiving)}</span>
                      <span className="text-muted-foreground">Tithe: {compactDollars(session.tithe)}</span>
                      <span className="text-muted-foreground">Gift/Offering: {compactDollars(session.giftOffering)}</span>
                      <span className="text-muted-foreground">Building Fund: {compactDollars(session.buildingFund)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-700" />
                Tithe
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Gift/Offering
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-lime-500" />
                Building Fund
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminUpcomingEventsCard() {
  const now = new Date().toISOString();
  const eventsQuery = useQuery({
    queryKey: ["dashboard-admin-events"],
    queryFn: () => eventsApiJson<{ events: ChurchEvent[] }>(`/admin/events?start=${now}&limit=5`),
  });
  const events = eventsQuery.data?.events ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Upcoming Services & Events
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/services">Manage</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {eventsQuery.isLoading && <SkeletonList rows={4} />}
        {eventsQuery.isError && (
          <EmptyState message="Could not load upcoming events." isError />
        )}
        {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
          <EmptyState
            message="No upcoming services or events scheduled."
            actionHref="/admin/services"
            actionLabel="Create Event"
          />
        )}
        {!eventsQuery.isLoading &&
          !eventsQuery.isError &&
          events.map((event) => {
            const start = event.occurrenceStartDatetime ?? event.startDatetime;
            const eventColors = eventTypeCalendarClasses(event.eventType);
            const dateLabel = new Date(start).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const timeLabel = new Date(start).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <div
                key={`${event.id}-${start}`}
                className="flex items-start justify-between gap-3 rounded-md border p-3 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${eventColors.single}`}>
                      {dateLabel}
                    </span>
                    <Badge variant="outline" className={`border-0 text-xs ${eventColors.single}`}>
                      {eventLabelize(event.eventType)}
                    </Badge>
                    {event.eventMode !== "in_person" && (
                      <Badge variant="outline" className="text-xs">
                        <Video className="mr-1 h-3 w-3" />
                        {eventLabelize(event.eventMode)}
                      </Badge>
                    )}
                    {event.status === "cancelled" && (
                      <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                    )}
                  </div>
                  <p className="font-medium truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeLabel}{event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/admin/services/${event.id}`}>View</Link>
                </Button>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  message,
  actionHref,
  actionLabel,
  isError,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
  isError?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-dashed p-5 text-center ${isError ? "border-destructive/30 bg-destructive/5" : ""}`}
    >
      <p className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}>
        {message}
      </p>
      {actionHref && actionLabel && (
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

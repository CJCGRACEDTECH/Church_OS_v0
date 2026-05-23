import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-context";
import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { apiJson, dollars, labelize, type GivingCampaign } from "@/lib/giving";
import { apiJson as eventsApiJson, formatDateTimeRange, labelize as eventLabelize, type ChurchEvent } from "@/lib/events";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Megaphone,
  Smile,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type DashboardSummary = {
  totalMembers: number;
  newMembersLast30Days: number;
  visitors: number;
  givingMtdCents: number;
  activeCampaigns: number;
  checkedInChildren: number;
  attendanceRateLast4: number | null;
  attendanceTrend: Array<{ sessionName: string; sessionDate: string; present: number; memberCount: number }>;
  givingTrend: Array<{ sessionName: string; sessionDate: string; totalCents: number }>;
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
  if (status === "visitor") return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200";
  return "bg-muted text-muted-foreground";
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const permissions = user?.adminPermissions ?? [];
  const canSeeGiving = hasPermission("admin", PERMISSIONS.GIVING_MANAGEMENT, permissions);
  const canSeeMembers = hasPermission("admin", PERMISSIONS.MEMBER_DIRECTORY, permissions);
  const canSeeAttendance = hasPermission("admin", PERMISSIONS.ATTENDANCE_MANAGEMENT, permissions);
  const canSeeChildren = hasPermission("admin", PERMISSIONS.ATTENDANCE_CHECKIN, permissions);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiJson<DashboardSummary>("/admin/dashboard/summary"),
  });

  const campaignsQuery = useQuery({
    queryKey: ["dashboard-campaigns"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/admin/giving/campaigns"),
    enabled: canSeeGiving,
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard-activity-log"],
    queryFn: () => apiJson<{ log: ActivityLogEntry[] }>("/admin/activity-log"),
  });

  const summary = summaryQuery.data;
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "active");

  const statCards = [
    {
      label: "Members",
      value: canSeeMembers ? String(summary?.totalMembers ?? 0) : "—",
      trend: summary
        ? `${summary.visitors} visitors · ${summary.newMembersLast30Days} new this month`
        : undefined,
      href: canSeeMembers ? "/admin/members" : undefined,
      icon: <Users className="h-4 w-4" />,
      loading: summaryQuery.isLoading,
      error: summaryQuery.isError,
    },
    {
      label: "Attendance Rate",
      value: canSeeAttendance
        ? summary?.attendanceRateLast4 != null
          ? `${summary.attendanceRateLast4}%`
          : "—"
        : "—",
      trend: "Last 4 sessions vs. total members",
      href: canSeeAttendance ? "/admin/attendance" : undefined,
      icon: <BarChart3 className="h-4 w-4" />,
      loading: summaryQuery.isLoading,
      error: summaryQuery.isError,
    },
    {
      label: "Children In",
      value: canSeeChildren ? String(summary?.checkedInChildren ?? 0) : "—",
      trend: "Currently checked in",
      href: canSeeChildren ? "/admin/check-in" : undefined,
      icon: <Smile className="h-4 w-4" />,
      loading: summaryQuery.isLoading,
      error: summaryQuery.isError,
    },
    {
      label: "Giving MTD",
      value: canSeeGiving ? dollars(summary?.givingMtdCents ?? 0) : "—",
      trend: `${summary?.activeCampaigns ?? 0} active campaigns`,
      href: canSeeGiving ? "/admin/giving" : undefined,
      icon: <BadgeDollarSign className="h-4 w-4" />,
      loading: summaryQuery.isLoading,
      error: summaryQuery.isError,
    },
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
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AdminUpcomingEventsCard />
          <AttendanceTrendCard
            trend={summary?.attendanceTrend ?? []}
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            canSee={canSeeAttendance}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GivingTrendCard
            trend={summary?.givingTrend ?? []}
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            canSee={canSeeGiving}
          />
          <CampaignsCard
            campaigns={activeCampaigns}
            isLoading={campaignsQuery.isLoading}
            isError={campaignsQuery.isError}
            canSee={canSeeGiving}
          />
        </div>

        <ActivityFeedCard
          log={activityQuery.data?.log ?? []}
          isLoading={activityQuery.isLoading}
          isError={activityQuery.isError}
        />

        <NewMembersCard
          members={summary?.recentNewMembers ?? []}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          canSee={canSeeMembers}
        />
      </div>
    </AdminLayout>
  );
}

function AttendanceTrendCard({
  trend,
  isLoading,
  isError,
  canSee,
}: {
  trend: DashboardSummary["attendanceTrend"];
  isLoading: boolean;
  isError: boolean;
  canSee: boolean;
}) {
  const memberCount = trend[0]?.memberCount ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Attendance Trend
          </CardTitle>
          <CardDescription>
            Present vs. {memberCount > 0 ? `${memberCount} total members` : "total members"} across last 8 sessions.
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/attendance">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
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
        {canSee && !isLoading && !isError && trend.length === 0 && (
          <EmptyState
            message="No attendance sessions recorded yet."
            actionHref="/admin/attendance"
            actionLabel="Record Attendance"
          />
        )}
        {canSee && !isLoading && !isError && trend.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-end gap-1.5 h-28">
              {trend.map((session, i) => {
                const mc = session.memberCount > 0 ? session.memberCount : 1;
                const presentPct = Math.min((session.present / mc) * 100, 100);
                const rate = Math.round((session.present / mc) * 100);
                const label = new Date(session.sessionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div className="w-full flex flex-col justify-end h-24 relative">
                      <div
                        className="w-full rounded-t-sm bg-primary/15 absolute bottom-0"
                        style={{ height: "100%" }}
                      />
                      <div
                        className="w-full rounded-t-sm bg-primary absolute bottom-0"
                        style={{ height: `${presentPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">
                      {label}
                    </span>
                    <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow border whitespace-nowrap z-10 flex-col items-center">
                      <span className="font-medium">{session.sessionName}</span>
                      <span>{session.present} / {session.memberCount} members ({rate}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
                Present
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/15" />
                Total Members
              </span>
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
}: {
  trend: DashboardSummary["givingTrend"];
  isLoading: boolean;
  isError: boolean;
  canSee: boolean;
}) {
  const maxCents = Math.max(...trend.map((t) => t.totalCents), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5" /> Giving per Service
          </CardTitle>
          <CardDescription>Total giving collected on each of the last 8 service dates.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/giving">View All</Link>
        </Button>
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
                const pct = (session.totalCents / maxCents) * 100;
                const label = new Date(session.sessionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div className="w-full flex flex-col justify-end h-24 relative">
                      <div
                        className="w-full rounded-t-sm bg-emerald-500 absolute bottom-0"
                        style={{ height: `${Math.max(pct, session.totalCents > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">
                      {label}
                    </span>
                    <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow border whitespace-nowrap z-10 flex-col items-center">
                      <span className="font-medium">{session.sessionName}</span>
                      <span>{session.totalCents > 0 ? dollars(session.totalCents) : "No giving recorded"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Giving collected
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignsCard({
  campaigns,
  isLoading,
  isError,
  canSee,
}: {
  campaigns: GivingCampaign[];
  isLoading: boolean;
  isError: boolean;
  canSee: boolean;
}) {
  const featured = campaigns.slice(0, 3);
  const totalRaised = campaigns.reduce((s, c) => s + c.amountRaisedCents, 0);
  const totalGoal = campaigns.reduce((s, c) => s + c.goalAmountCents, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Active Campaigns
          </CardTitle>
          <CardDescription>Current giving campaigns and progress.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/giving">Manage</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canSee && <EmptyState message="Giving permissions required to view campaigns." />}
        {canSee && isLoading && <SkeletonList rows={3} />}
        {canSee && isError && <EmptyState message="Could not load campaigns." isError />}
        {canSee && !isLoading && !isError && campaigns.length === 0 && (
          <EmptyState
            message="No active campaigns yet."
            actionHref="/admin/giving"
            actionLabel="Create Campaign"
          />
        )}
        {canSee && !isLoading && !isError && campaigns.length > 0 && (
          <>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">All Active</span>
                <Badge variant="secondary">{campaigns.length}</Badge>
              </div>
              <p className="mt-2 text-2xl font-semibold">{dollars(totalRaised)}</p>
              <p className="text-xs text-muted-foreground">raised of {dollars(totalGoal)}</p>
            </div>
            <div className="space-y-3">
              {featured.map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{c.campaignName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.campaignCategory ?? labelize(c.status)}
                      </p>
                    </div>
                    <Badge variant="outline">{c.progressPercent}%</Badge>
                  </div>
                  <Progress className="mt-3" value={c.progressPercent} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dollars(c.amountRaisedCents)} raised of {dollars(c.goalAmountCents)}
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

function ActivityFeedCard({
  log,
  isLoading,
  isError,
}: {
  log: ActivityLogEntry[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Recent Activity
          </CardTitle>
          <CardDescription>Admin logins and invitation activity.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/settings?tab=admins">Manage</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <SkeletonList rows={5} />}
        {isError && <EmptyState message="Could not load activity." isError />}
        {!isLoading && !isError && log.length === 0 && (
          <EmptyState message="No recent activity recorded." />
        )}
        {!isLoading &&
          !isError &&
          log.slice(0, 10).map((entry, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border p-3">
              <div className="h-2 w-2 rounded-full shrink-0 bg-primary/60 mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.label}</p>
                <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                {entry.timestamp && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="shrink-0 capitalize text-xs">
                {entry.status}
              </Badge>
            </div>
          ))}
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
          <CardDescription>Next 5 services and events on the calendar.</CardDescription>
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
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {dateLabel}
                    </span>
                    <Badge variant="secondary" className="text-xs">
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

function NewMembersCard({
  members,
  isLoading,
  isError,
  canSee,
}: {
  members: DashboardSummary["recentNewMembers"];
  isLoading: boolean;
  isError: boolean;
  canSee: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> New Members & Visitors
          </CardTitle>
          <CardDescription>Profiles added in the last 30 days.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/members">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!canSee && <EmptyState message="Member directory permissions required." />}
        {canSee && isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {canSee && isError && <EmptyState message="Could not load new members." isError />}
        {canSee && !isLoading && !isError && members.length === 0 && (
          <EmptyState
            message="No new members or visitors in the last 30 days."
            actionHref="/admin/members"
            actionLabel="Add Member"
          />
        )}
        {canSee && !isLoading && !isError && members.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {members.map((m) => (
              <Link key={m.id} href={`/admin/members/${m.id}`}>
                <div className="rounded-md border p-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center shrink-0">
                      {initials(m.firstName, m.lastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${memberStatusColor(m.memberStatus)}`}
                    >
                      {labelize(m.memberStatus ?? "unknown")}
                    </Badge>
                    {m.ministryDepartment && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 truncate max-w-[120px]">
                        {m.ministryDepartment}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
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

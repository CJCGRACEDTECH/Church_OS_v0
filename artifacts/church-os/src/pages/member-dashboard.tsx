import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-context";
import MemberLayout from "@/components/MemberLayout";
import EventsFeed from "@/components/EventsFeed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJson, labelize } from "@/lib/events";
import { dollars, type GivingCampaign } from "@/lib/giving";
import { Link } from "wouter";
import { CalendarDays, CheckCircle2, Gift, User, Users } from "lucide-react";

type HouseholdPerson = {
  id: number;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  profilePhotoUrl: string | null;
  relationshipLabel: string;
};

type HouseholdSummary = {
  primaryMember: { id: number; firstName: string; lastName: string; preferredName: string | null; profilePhotoUrl: string | null };
  members: Array<{ id: number; firstName: string; lastName: string; preferredName: string | null; profilePhotoUrl: string | null; relationship: string }>;
  children: Array<{ id: number; firstName: string; lastName: string; profilePhotoUrl: string | null; relationship: string }>;
};

type MemberAttendanceRecord = {
  id: number;
  sessionId: number;
  sessionName: string;
  attendanceType: "regular_service" | "discipleship";
  sessionDate: string;
  location: string | null;
  attendanceStatus: string;
  checkinSource: string;
  checkinTime: string;
};

type MemberAttendanceHistory = {
  summary: {
    isDisciple: boolean;
    servicePresent: number;
    serviceTotal: number;
    discipleshipPresent: number;
    discipleshipTotal: number;
  };
  serviceRecords: MemberAttendanceRecord[];
  discipleshipRecords: MemberAttendanceRecord[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const [householdOpen, setHouseholdOpen] = React.useState(false);
  const attendanceQuery = useQuery({
    queryKey: ["member-attendance-history"],
    queryFn: () => apiJson<MemberAttendanceHistory>("/member/attendance/history"),
  });
  const campaignsQuery = useQuery({
    queryKey: ["giving-campaigns-member"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/giving/campaigns"),
  });
  const householdQuery = useQuery({
    queryKey: ["member-household-summary"],
    queryFn: () => apiJson<{ household: HouseholdSummary }>("/member/household"),
  });
  const attendance = attendanceQuery.data;
  const activeCampaigns = campaignsQuery.data?.campaigns ?? [];
  const showDiscipleshipAttendance = attendance?.summary.isDisciple === true;
  const household = householdQuery.data?.household;
  const householdMembers: HouseholdPerson[] = household
    ? [
        ...household.members.map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          preferredName: member.preferredName,
          profilePhotoUrl: member.profilePhotoUrl,
          relationshipLabel: labelize(member.relationship) || "Household",
        })),
        ...household.children.map((child) => ({
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          profilePhotoUrl: child.profilePhotoUrl,
          relationshipLabel: labelize(child.relationship) || "Child",
        })),
      ]
    : [];
  const householdCount = householdMembers.length + 1;

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 border border-blue-200 bg-white">
                {user?.profilePhotoUrl && <AvatarImage src={user.profilePhotoUrl} alt={`${user.firstName} ${user.lastName}`} />}
                <AvatarFallback className="bg-transparent text-xl font-semibold text-primary">
                  {user?.preferredName?.[0] || user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Member Portal</p>
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  Welcome back, {user?.preferredName || user?.firstName}
                </h1>
                <p className="truncate text-sm text-muted-foreground">{user?.churchName ?? "Your church"} · {user?.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button asChild>
                <Link href="/member/profile">
                  <User />
                  My Profile
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/member/services">
                  <CalendarDays />
                  Services
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-blue-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                  <User className="h-4 w-4" />
                </span>
                My Profile
              </CardTitle>
              <CardDescription>Personal details and account information.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 pt-2">
                <Avatar className="h-16 w-16 border border-blue-200 bg-white">
                  {user?.profilePhotoUrl && <AvatarImage src={user.profilePhotoUrl} alt={`${user.firstName} ${user.lastName}`} />}
                  <AvatarFallback className="bg-transparent text-xl text-primary">
                    {user?.preferredName?.[0] || user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium">
                    {user?.preferredName || user?.firstName} {user?.lastName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-4 w-full bg-white/80">
                <Link href="/member/profile">View Profile</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-amber-400" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-800">
                  <Users className="h-4 w-4" />
                </span>
                My Household
              </CardTitle>
              <CardDescription>Family and household connections.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 pt-4">
                <div className="flex -space-x-2">
                  <Avatar className="h-8 w-8 border-2 border-white">
                    <AvatarFallback className="bg-white text-xs text-amber-800">Me</AvatarFallback>
                  </Avatar>
                  {householdMembers.slice(0, 3).map((person) => (
                    <Avatar key={person.id} className="h-8 w-8 border-2 border-white">
                      {person.profilePhotoUrl && <AvatarImage src={person.profilePhotoUrl} alt={`${person.firstName} ${person.lastName}`} />}
                      <AvatarFallback className="bg-white text-xs text-amber-800">{person.firstName[0]}{person.lastName[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground ml-2">
                  {householdQuery.isLoading ? "Loading..." : `${householdCount} ${householdCount === 1 ? "Member" : "Members"}`}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full bg-white/80" onClick={() => setHouseholdOpen(true)}>
                  Quick View
                </Button>
                <Button asChild variant="outline" className="w-full bg-white/80">
                  <Link href="/member/household">Full Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-blue-400" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                My Attendance
              </CardTitle>
              <CardDescription>Recent service attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AttendanceGroup
                title="Service Attendance"
                present={attendance?.summary.servicePresent ?? 0}
                total={attendance?.summary.serviceTotal ?? 0}
                records={attendance?.serviceRecords ?? []}
                loading={attendanceQuery.isLoading}
              />
              {showDiscipleshipAttendance && (
                <AttendanceGroup
                  title="Discipleship"
                  present={attendance?.summary.discipleshipPresent ?? 0}
                  total={attendance?.summary.discipleshipTotal ?? 0}
                  records={attendance?.discipleshipRecords ?? []}
                  loading={attendanceQuery.isLoading}
                />
              )}
            </CardContent>
          </Card>

          <EventsFeed detailBasePath="/member/services" />

          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-amber-400" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-800">
                  <Gift className="h-4 w-4" />
                </span>
                Giving Campaigns
              </CardTitle>
              <CardDescription>Active giving goals and church initiatives.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeCampaigns.slice(0, 2).map((campaign) => (
                  <div key={campaign.id} className="rounded-lg border border-blue-100 bg-white/75 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{campaign.campaignName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dollars(campaign.amountRaisedCents)} of {dollars(campaign.goalAmountCents)}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">{campaign.progressPercent}%</Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }} />
                    </div>
                  </div>
                ))}
                {!campaignsQuery.isLoading && !activeCampaigns.length && (
                  <p className="rounded-md bg-muted/35 px-3 py-6 text-center text-sm text-muted-foreground">
                    No active campaigns right now.
                  </p>
                )}
                {campaignsQuery.isLoading && (
                  <p className="rounded-md bg-muted/35 px-3 py-6 text-center text-sm text-muted-foreground">
                    Loading campaigns...
                  </p>
                )}
              </div>
              <Button asChild variant="outline" className="mt-4 w-full bg-white/80">
                <Link href="/member/give">View Giving Methods</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={householdOpen} onOpenChange={setHouseholdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Household</DialogTitle>
            <DialogDescription>Everyone linked to your household, including children ministry records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10 border">
                  {user?.profilePhotoUrl && <AvatarImage src={user.profilePhotoUrl} alt={`${user.firstName} ${user.lastName}`} />}
                  <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{user?.preferredName || user?.firstName} {user?.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Badge variant="outline">You</Badge>
            </div>
            {householdMembers.map((person) => (
              <div key={person.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 border">
                    {person.profilePhotoUrl && <AvatarImage src={person.profilePhotoUrl} alt={`${person.firstName} ${person.lastName}`} />}
                    <AvatarFallback>{person.firstName[0]}{person.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <p className="truncate font-medium">{person.firstName} {person.lastName}</p>
                </div>
                <Badge variant="outline">{person.relationshipLabel}</Badge>
              </div>
            ))}
            {!householdMembers.length && !householdQuery.isLoading && (
              <p className="rounded-md bg-muted/35 px-3 py-6 text-center text-sm text-muted-foreground">
                No other household members linked yet.
              </p>
            )}
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/member/household">View Full Household Page</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </MemberLayout>
  );
}

function AttendanceGroup({
  title,
  present,
  total,
  records,
  loading,
}: {
  title: string;
  present: number;
  total: number;
  records: MemberAttendanceRecord[];
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{loading ? "Loading..." : `${present}/${total} present`}</p>
        </div>
        <Badge variant="secondary">{total ? `${Math.round((present / total) * 100)}%` : "0%"}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {records.slice(0, 3).map((record) => (
          <div key={record.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/35 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{record.sessionName}</p>
              <p className="text-xs text-muted-foreground">{formatDate(record.sessionDate)}</p>
            </div>
            <Badge variant={record.attendanceStatus === "present" ? "default" : "outline"}>
              {labelize(record.attendanceStatus)}
            </Badge>
          </div>
        ))}
        {!loading && !records.length && (
          <p className="rounded-md bg-muted/35 px-3 py-6 text-center text-sm text-muted-foreground">
            No attendance records yet.
          </p>
        )}
      </div>
    </div>
  );
}

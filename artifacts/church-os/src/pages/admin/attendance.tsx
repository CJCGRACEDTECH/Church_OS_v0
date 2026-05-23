import React from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiJson, formatDate, formatDateTime, labelize, type AttendanceMember, type AttendanceRecord, type AttendanceSession } from "@/lib/attendance";
import { ArrowLeft, BarChart3, CheckCircle2, MessageSquare, Pencil, Plus, Printer, QrCode, Search, Users, XCircle } from "lucide-react";

type SessionWithCounts = AttendanceSession & { presentCount: number; memberCount: number };

type AttendanceSummary = {
  totalMembers: number;
  totalToday: number;
  activeSessions: number;
  weeklyAttendance: number;
  discipleshipAttendance: number;
  membersPresent: number;
  visitorsCount: number;
  regularSessionCount: number;
  regularAvgAttendance: number;
  discipleshipSessionCount: number;
  discipleshipAvgAttendance: number;
};

type SessionForm = {
  attendanceType: "regular_service" | "discipleship";
  serviceEventId: string;
  sessionName: string;
  sessionDate: string;
  startTime: string;
  location: string;
  discipleshipGroup: string;
  teacherLeader: string;
  lessonTopic: string;
  qrEnabled: boolean;
  qrExpiration: string;
  sessionStatus: "upcoming" | "active" | "closed";
};

const emptyForm = (): SessionForm => {
  const start = new Date();
  start.setHours(19, 0, 0, 0);
  const exp = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return {
    attendanceType: "regular_service",
    serviceEventId: "",
    sessionName: "",
    sessionDate: start.toISOString().slice(0, 10),
    startTime: "19:00",
    location: "",
    discipleshipGroup: "",
    teacherLeader: "",
    lessonTopic: "",
    qrEnabled: true,
    qrExpiration: exp.toISOString().slice(0, 16),
    sessionStatus: "active",
  };
};

function useQrCountdown(qrExpiration: string | undefined) {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    if (!qrExpiration) return;
    const compute = () => {
      const diff = new Date(qrExpiration).getTime() - Date.now();
      if (diff <= 0) { setLabel("Expired"); return; }
      const mins = Math.ceil(diff / 60000);
      setLabel(mins === 1 ? "Expires in 1 min" : `Expires in ${mins} min`);
    };
    compute();
    const id = setInterval(compute, 60000);
    return () => clearInterval(id);
  }, [qrExpiration]);
  return label;
}

export default function AdminAttendance() {
  const [, params] = useRoute("/admin/attendance/:id");
  return params?.id ? <AttendanceSessionDetail sessionId={Number(params.id)} /> : <AttendanceDashboard />;
}

function AttendanceDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [form, setForm] = React.useState<SessionForm>(emptyForm);

  const summaryQuery = useQuery({
    queryKey: ["attendance-summary"],
    queryFn: () => apiJson<AttendanceSummary>("/admin/attendance/summary"),
  });
  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions", search, type, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (type) params.set("type", type);
      if (statusFilter) params.set("status", statusFilter);
      return apiJson<{ sessions: SessionWithCounts[] }>(`/admin/attendance/sessions${params.toString() ? `?${params}` : ""}`);
    },
  });

  const createSession = useMutation({
    mutationFn: () => apiJson<{ session: AttendanceSession }>("/admin/attendance/sessions", { method: "POST", body: JSON.stringify(sessionPayload(form)) }),
    onSuccess: () => {
      setCreateOpen(false);
      setForm(emptyForm());
      toast({ title: "Attendance session created" });
      void queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (error) => toast({ title: "Could not create session", description: error.message, variant: "destructive" }),
  });

  const closeSession = useMutation({
    mutationFn: (sessionId: number) => apiJson<{ session: AttendanceSession }>(`/admin/attendance/sessions/${sessionId}/close`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Session closed" });
      void queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (error) => toast({ title: "Could not close session", description: error.message, variant: "destructive" }),
  });

  const summary = summaryQuery.data;
  const sessions = sessionsQuery.data?.sessions ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Services & Discipleship</p>
            <h1 className="text-3xl font-semibold tracking-tight">Attendance</h1>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create Session</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Attendance Session</DialogTitle>
                <DialogDescription>Create regular service or Friday discipleship attendance with an optional QR link.</DialogDescription>
              </DialogHeader>
              <SessionFormView form={form} setForm={setForm} onSubmit={() => createSession.mutate()} isSubmitting={createSession.isPending} submitLabel="Create Session" />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Today" value={summary ? `${summary.totalToday} / ${summary.totalMembers}` : "—"} trend="Members present today" />
          <StatCard label="Active Sessions" value={String(summary?.activeSessions ?? 0)} trend="Open now" />
          <StatCard label="Weekly Attendance" value={summary ? `${summary.weeklyAttendance} / ${summary.totalMembers}` : "—"} trend="Members present this week" />
          <StatCard label="Discipleship" value={String(summary?.discipleshipAttendance ?? 0)} trend="Friday groups" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Regular Service</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary?.regularSessionCount ?? 0} <span className="text-sm font-normal text-muted-foreground">sessions</span></p>
              <p className="text-xs text-muted-foreground mt-1">Avg {summary?.regularAvgAttendance ?? 0} present per service</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Discipleship</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary?.discipleshipSessionCount ?? 0} <span className="text-sm font-normal text-muted-foreground">sessions</span></p>
              <p className="text-xs text-muted-foreground mt-1">Avg {summary?.discipleshipAvgAttendance ?? 0} present per session</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Attendance Sessions</CardTitle>
            <CardDescription>Regular service attendance and Friday night discipleship stay separate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search session or group" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All types</option>
                <option value="regular_service">Regular Service</option>
                <option value="discipleship">Discipleship</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>QR</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsQuery.isLoading
                    ? Array.from({ length: 4 }, (_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))
                    : sessions.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            {search || type || statusFilter ? "No sessions match your filters." : "No attendance sessions yet — create one to get started."}
                          </TableCell>
                        </TableRow>
                      )
                    : sessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            <Link href={`/admin/attendance/${session.id}`} className="font-medium hover:underline">{session.sessionName}</Link>
                            {session.discipleshipGroup && <p className="text-xs text-muted-foreground">{session.discipleshipGroup}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={session.attendanceType === "discipleship" ? "secondary" : "outline"}>
                              {session.attendanceType === "discipleship" ? "Discipleship" : "Service"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(session.sessionDate)}</TableCell>
                          <TableCell>
                            <Badge variant={session.sessionStatus === "active" ? "default" : session.sessionStatus === "upcoming" ? "outline" : "secondary"}>
                              {labelize(session.sessionStatus)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium tabular-nums">
                            {session.presentCount} / {session.memberCount}
                          </TableCell>
                          <TableCell>
                            {session.qrEnabled
                              ? <Badge variant="outline" className="text-emerald-700 border-emerald-300">QR On</Badge>
                              : <span className="text-xs text-muted-foreground">Off</span>
                            }
                          </TableCell>
                          <TableCell>
                            {session.sessionStatus === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={closeSession.isPending}
                                onClick={() => closeSession.mutate(session.id)}
                              >
                                <XCircle className="mr-1 h-3 w-3" />Close
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  }
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function AttendanceSessionDetail({ sessionId }: { sessionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = React.useState("");
  const [selectedMemberId, setSelectedMemberId] = React.useState("");
  const [status, setStatus] = React.useState("present");
  const [notes, setNotes] = React.useState("");
  const [followUpNeeded, setFollowUpNeeded] = React.useState(false);
  const [completionStatus, setCompletionStatus] = React.useState("attended");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<SessionForm>(emptyForm);
  const [followUpOnly, setFollowUpOnly] = React.useState(false);

  const sessionQuery = useQuery({
    queryKey: ["attendance-session", sessionId],
    queryFn: () => apiJson<{ session: AttendanceSession; memberCount: number; records: AttendanceRecord[] }>(`/admin/attendance/sessions/${sessionId}`),
  });
  const membersQuery = useQuery({
    queryKey: ["attendance-member-search", memberSearch],
    queryFn: () => apiJson<{ members: AttendanceMember[] }>(`/admin/attendance/members${memberSearch ? `?search=${encodeURIComponent(memberSearch)}` : ""}`),
  });
  const markRecord = useMutation({
    mutationFn: () => apiJson<{ record: AttendanceRecord }>(`/admin/attendance/sessions/${sessionId}/records`, {
      method: "POST",
      body: JSON.stringify({ memberId: Number(selectedMemberId), attendanceStatus: status, notes, followUpNeeded, completionStatus }),
    }),
    onSuccess: () => {
      setSelectedMemberId("");
      setNotes("");
      toast({ title: "Attendance recorded" });
      void queryClient.invalidateQueries({ queryKey: ["attendance-session", sessionId] });
    },
    onError: (error) => toast({ title: "Could not record attendance", description: error.message, variant: "destructive" }),
  });
  const updateSession = useMutation({
    mutationFn: () => apiJson<{ session: AttendanceSession }>(`/admin/attendance/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(sessionPayload(editForm)),
    }),
    onSuccess: () => {
      setEditOpen(false);
      toast({ title: "Attendance session updated" });
      void queryClient.invalidateQueries({ queryKey: ["attendance-session", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (error) => toast({ title: "Could not update session", description: error.message, variant: "destructive" }),
  });
  const sendFollowUpSms = useMutation({
    mutationFn: () => apiJson<{ sent: number; failed: number; notConfigured: boolean }>(`/admin/attendance/sessions/${sessionId}/follow-up-sms`, { method: "POST" }),
    onSuccess: (data) => {
      if (data.notConfigured) {
        toast({ title: "SMS not configured", description: "Add Twilio credentials to enable SMS follow-ups.", variant: "destructive" });
      } else {
        toast({ title: `Follow-up SMS sent`, description: `${data.sent} sent · ${data.failed} failed` });
      }
    },
    onError: (error) => toast({ title: "Could not send SMS", description: error.message, variant: "destructive" }),
  });

  const session = sessionQuery.data?.session;
  const memberCount = sessionQuery.data?.memberCount ?? 0;
  const records = sessionQuery.data?.records ?? [];
  const qrUrl = session ? `${window.location.origin}/attendance/check-in/${session.qrToken}` : "";
  const followUpCount = records.filter((r) => r.followUpNeeded).length;
  const qrCountdown = useQrCountdown(session?.qrExpiration);

  const presentCount = records.filter((r) => r.attendanceStatus === "present").length;
  const absentCount = records.filter((r) => r.attendanceStatus === "absent").length;
  const lateCount = records.filter((r) => r.attendanceStatus === "late").length;
  const excusedCount = records.filter((r) => r.attendanceStatus === "excused").length;

  const attendedCount = records.filter((r) => r.completionStatus === "attended").length;
  const missedCount = records.filter((r) => r.completionStatus === "missed").length;
  const makeUpCount = records.filter((r) => r.completionStatus === "make_up_needed").length;

  const visibleRecords = followUpOnly ? records.filter((r) => r.followUpNeeded) : records;

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }

  function handlePrintQr() {
    const svg = document.getElementById("attendance-qr-svg");
    if (!svg) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const safeName = escapeHtml(session?.sessionName ?? "");
    const safeUrl = escapeHtml(qrUrl);
    win.document.write(`<html><head><title>QR Check-In — ${safeName}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px} p{font-size:14px;color:#555;text-align:center}</style></head><body>${svg.outerHTML}<p>${safeName}<br/>${safeUrl}</p></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  if (sessionQuery.isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Button variant="ghost" className="px-0" asChild><Link href="/admin/attendance"><ArrowLeft className="mr-2 h-4 w-4" />Attendance</Link></Button>
        {session ? (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{session.sessionName}</h1>
                <p className="text-muted-foreground">{formatDateTime(session.sessionDate)} · {session.location ?? "No location"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={session.sessionStatus === "active" ? "default" : "secondary"}>{labelize(session.sessionStatus)}</Badge>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => setEditForm(formFromSession(session))}>
                      <Pencil className="mr-2 h-4 w-4" />Edit Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Attendance Session</DialogTitle>
                      <DialogDescription>Update session details, status, discipleship fields, or QR expiration.</DialogDescription>
                    </DialogHeader>
                    <SessionFormView form={editForm} setForm={setEditForm} onSubmit={() => updateSession.mutate()} isSubmitting={updateSession.isPending} submitLabel="Save Changes" />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Check-In</CardTitle><CardDescription>Members scan and check themselves in while logged in.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {session.qrEnabled ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-md border bg-white p-3">
                        <QRCodeSVG id="attendance-qr-svg" value={qrUrl} size={200} level="M" includeMargin={false} />
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={handlePrintQr}>
                        <Printer className="mr-2 h-4 w-4" />Print QR Code
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">QR is disabled.</p>
                  )}
                  <p className="break-all rounded-md bg-muted p-2 text-xs">{qrUrl}</p>
                  <div className="flex items-center gap-2">
                    {qrCountdown === "Expired"
                      ? <Badge variant="destructive">Expired</Badge>
                      : <Badge variant="outline" className="text-emerald-700 border-emerald-300">{qrCountdown}</Badge>
                    }
                  </div>
                  {followUpCount > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-800">{followUpCount} member{followUpCount !== 1 ? "s" : ""} flagged for follow-up</p>
                      <Button size="sm" variant="outline" className="w-full border-amber-300 text-amber-800 hover:bg-amber-100" disabled={sendFollowUpSms.isPending} onClick={() => sendFollowUpSms.mutate()}>
                        <MessageSquare className="mr-2 h-3.5 w-3.5" />
                        {sendFollowUpSms.isPending ? "Sending…" : "Send Follow-up SMS"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Manual Attendance</CardTitle><CardDescription>Search members, mark present/late/absent/excused, and add discipleship follow-up details.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Search members" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                    <select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Select member</option>
                      {(membersQuery.data?.members ?? []).map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.email}</option>)}
                    </select>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option>
                    </select>
                    {session.attendanceType === "discipleship" && (
                      <select value={completionStatus} onChange={(e) => setCompletionStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="attended">Attended</option><option value="missed">Missed</option><option value="make_up_needed">Make-up Needed</option>
                      </select>
                    )}
                  </div>
                  {session.attendanceType === "discipleship" && (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} /> Follow-up needed</label>
                  )}
                  <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <Button disabled={!selectedMemberId || markRecord.isPending} onClick={() => markRecord.mutate()}><CheckCircle2 className="mr-2 h-4 w-4" />Record Attendance</Button>
                </CardContent>
              </Card>
            </div>

            {session.attendanceType === "discipleship" && records.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Completion Summary</CardTitle>
                  <CardDescription>Discipleship lesson completion breakdown for this session.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-md border p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{attendedCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Attended</p>
                    </div>
                    <div className="rounded-md border p-4 text-center">
                      <p className="text-2xl font-bold text-rose-600">{missedCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Missed</p>
                    </div>
                    <div className="rounded-md border p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">{makeUpCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Make-up Needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Attendance Records</CardTitle>
                  {records.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Switch checked={followUpOnly} onCheckedChange={setFollowUpOnly} />
                        Follow-up only
                      </label>
                    </div>
                  )}
                </div>
                {records.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100">{presentCount} / {memberCount} Present</Badge>
                    <Badge variant="secondary">{absentCount} Absent</Badge>
                    <Badge variant="outline" className="text-amber-700 border-amber-300">{lateCount} Late</Badge>
                    <Badge variant="outline">{excusedCount} Excused</Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.memberName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={record.attendanceStatus === "present" ? "default" : "secondary"}
                            className={record.attendanceStatus === "present" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200" : record.attendanceStatus === "late" ? "border-amber-300 text-amber-700" : ""}
                          >
                            {labelize(record.attendanceStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{labelize(record.checkinSource)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(record.checkinTime)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{record.notes ?? (record.followUpNeeded ? <span className="text-amber-700 font-medium">Follow-up needed</span> : "")}</TableCell>
                      </TableRow>
                    ))}
                    {visibleRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          {followUpOnly ? "No members flagged for follow-up." : "No records yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Session not found.</CardContent></Card>
        )}
      </div>
    </AdminLayout>
  );
}

function SessionFormView({ form, setForm, onSubmit, isSubmitting, submitLabel }: { form: SessionForm; setForm: React.Dispatch<React.SetStateAction<SessionForm>>; onSubmit: () => void; isSubmitting: boolean; submitLabel: string }) {
  const set = (key: keyof SessionForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Attendance Type</Label><select value={form.attendanceType} onChange={(e) => set("attendanceType", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="regular_service">Regular Service</option><option value="discipleship">Friday Discipleship</option></select></div>
        <div className="space-y-2"><Label>Session Status</Label><select value={form.sessionStatus} onChange={(e) => set("sessionStatus", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="closed">Closed</option></select></div>
        <TextInput label="Session Name" value={form.sessionName} onChange={(v) => set("sessionName", v)} required />
        <TextInput label="Session Date" type="date" value={form.sessionDate} onChange={(v) => set("sessionDate", v)} required />
        <TextInput label="Start Time" type="time" value={form.startTime} onChange={(v) => set("startTime", v)} />
        <TextInput label="Location / Online" value={form.location} onChange={(v) => set("location", v)} />
        {form.attendanceType === "discipleship" && (
          <>
            <TextInput label="Group / Class Name" value={form.discipleshipGroup} onChange={(v) => set("discipleshipGroup", v)} />
            <TextInput label="Teacher / Leader" value={form.teacherLeader} onChange={(v) => set("teacherLeader", v)} />
            <TextInput label="Lesson Topic" value={form.lessonTopic} onChange={(v) => set("lessonTopic", v)} />
          </>
        )}
        <div className="space-y-2 col-span-full md:col-span-1">
          <Label>QR Expiration</Label>
          <Input type="datetime-local" value={form.qrExpiration} onChange={(e) => set("qrExpiration", e.target.value)} required />
          <p className="text-xs text-muted-foreground">Set when the QR code stops accepting check-ins.</p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.qrEnabled} onChange={(e) => set("qrEnabled", e.target.checked)} /> Enable QR self check-in</label>
      <DialogFooter><Button type="submit" disabled={isSubmitting}>{submitLabel}</Button></DialogFooter>
    </form>
  );
}

function TextInput({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></div>;
}

function sessionPayload(form: SessionForm) {
  return {
    ...form,
    serviceEventId: form.serviceEventId ? Number(form.serviceEventId) : null,
    sessionDate: new Date(`${form.sessionDate}T${form.startTime || "00:00"}`).toISOString(),
    qrExpiration: new Date(form.qrExpiration).toISOString(),
  };
}

function formFromSession(session: AttendanceSession): SessionForm {
  const sessionDate = new Date(session.sessionDate);
  const qrExpiration = new Date(session.qrExpiration);
  return {
    attendanceType: session.attendanceType,
    serviceEventId: session.serviceEventId ? String(session.serviceEventId) : "",
    sessionName: session.sessionName,
    sessionDate: sessionDate.toISOString().slice(0, 10),
    startTime: session.startTime ?? sessionDate.toTimeString().slice(0, 5),
    location: session.location ?? "",
    discipleshipGroup: session.discipleshipGroup ?? "",
    teacherLeader: session.teacherLeader ?? "",
    lessonTopic: session.lessonTopic ?? "",
    qrEnabled: session.qrEnabled,
    qrExpiration: qrExpiration.toISOString().slice(0, 16),
    sessionStatus: session.sessionStatus,
  };
}

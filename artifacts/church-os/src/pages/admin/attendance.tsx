import React from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiJson, formatDate, formatDateTime, labelize, type AttendanceMember, type AttendanceRecord, type AttendanceSession } from "@/lib/attendance";
import { ArrowLeft, BarChart3, CheckCircle2, Pencil, Plus, QrCode, Search, Users } from "lucide-react";

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

export default function AdminAttendance() {
  const [location] = useLocation();
  const match = location.match(/^\/admin\/attendance\/(\d+)$/);
  return match ? <AttendanceSessionDetail sessionId={Number(match[1])} /> : <AttendanceDashboard />;
}

function AttendanceDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("");
  const [form, setForm] = React.useState<SessionForm>(emptyForm);

  const summaryQuery = useQuery({
    queryKey: ["attendance-summary"],
    queryFn: () => apiJson<{
      totalToday: number;
      activeSessions: number;
      weeklyAttendance: number;
      regularService?: { averagePerSession: number; latestSessionCount: number };
      discipleship?: { totalTaggedDisciples: number; latestCheckedIn: number; latestAttendanceRate: number; averagePerSession: number };
    }>("/admin/attendance/summary"),
  });
  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions", search, type],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (type) params.set("type", type);
      return apiJson<{ sessions: AttendanceSession[] }>(`/admin/attendance/sessions${params.toString() ? `?${params}` : ""}`);
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

  const summary = summaryQuery.data;
  const sessions = sessionsQuery.data?.sessions ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Services & Discipleship"
          title="Attendance"
          description="Track attendance across regular services and discipleship groups."
          icon={<BarChart3 className="h-6 w-6" />}
          actions={
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
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Avg / Service" value={String(summary?.regularService?.averagePerSession ?? summary?.weeklyAttendance ?? 0)} trend="Regular services only" />
          <StatCard label="Latest Service" value={String(summary?.regularService?.latestSessionCount ?? 0)} trend="Latest regular service" />
          <StatCard label="Total Disciples" value={String(summary?.discipleship?.totalTaggedDisciples ?? 0)} trend="Tagged disciples" />
          <StatCard label="Discipleship Avg" value={String(summary?.discipleship?.averagePerSession ?? 0)} trend="Average per service" />
          <StatCard label="Discipleship Rate" value={`${summary?.discipleship?.latestAttendanceRate ?? 0}%`} trend="Latest attendance percentage" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Attendance Sessions</CardTitle>
            <CardDescription>Regular service attendance and Friday night discipleship stay separate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search session or discipleship group" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All attendance types</option>
                <option value="regular_service">Regular Service</option>
                <option value="discipleship">Discipleship</option>
              </select>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>QR</TableHead></TableRow></TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id} className="cursor-pointer">
                      <TableCell><Link href={`/admin/attendance/${session.id}`} className="font-medium hover:underline">{session.sessionName}</Link></TableCell>
                      <TableCell>{labelize(session.attendanceType)}</TableCell>
                      <TableCell>{formatDate(session.sessionDate)}</TableCell>
                      <TableCell><Badge variant={session.sessionStatus === "active" ? "default" : "secondary"}>{labelize(session.sessionStatus)}</Badge></TableCell>
                      <TableCell>{session.qrEnabled ? <Badge variant="outline">Enabled</Badge> : "Off"}</TableCell>
                    </TableRow>
                  ))}
                  {!sessions.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No attendance sessions found.</TableCell></TableRow>}
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
  const [manualOpen, setManualOpen] = React.useState(false);
  const [checkinScreenOpen, setCheckinScreenOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<SessionForm>(emptyForm);
  const sessionQuery = useQuery({
    queryKey: ["attendance-session", sessionId],
    queryFn: () => apiJson<{ session: AttendanceSession; records: AttendanceRecord[]; disciplesTotal: number; checkedInDisciples: number; discipleshipAttendanceRate: number; serviceBreakdown: { activeMember: number; member: number; visitor: number } }>(`/admin/attendance/sessions/${sessionId}`),
  });
  const membersQuery = useQuery({
    queryKey: ["attendance-member-search", memberSearch],
    queryFn: () => apiJson<{ members: AttendanceMember[] }>(`/admin/attendance/members${memberSearch ? `?search=${encodeURIComponent(memberSearch)}` : ""}`),
  });
  const markRecord = useMutation({
    mutationFn: () => apiJson<{ record: AttendanceRecord }>(`/admin/attendance/sessions/${sessionId}/records`, {
      method: "POST",
      body: JSON.stringify({ memberId: Number(selectedMemberId), attendanceStatus: status, notes }),
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
  const session = sessionQuery.data?.session;
  const records = sessionQuery.data?.records ?? [];
  const presentRecords = records.filter((record) => record.attendanceStatus === "present");
  const checkedInDisciples = sessionQuery.data?.checkedInDisciples ?? 0;
  const disciplesTotal = sessionQuery.data?.disciplesTotal ?? 0;
  const serviceBreakdown = sessionQuery.data?.serviceBreakdown ?? { activeMember: 0, member: 0, visitor: 0 };
  const qrUrl = session ? `${window.location.origin}/attendance/check-in/${session.qrToken}` : "";
  const qrImage = qrUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}` : "";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Button variant="ghost" className="px-0" asChild><Link href="/admin/attendance"><ArrowLeft className="mr-2 h-4 w-4" />Attendance</Link></Button>
        {session ? (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div><h1 className="text-3xl font-semibold tracking-tight">{session.sessionName}</h1><p className="text-muted-foreground">{formatDateTime(session.sessionDate)} · {session.location ?? "No location"}</p></div>
              <div className="flex items-center gap-2">
                <Badge variant={session.sessionStatus === "active" ? "default" : "secondary"}>{labelize(session.sessionStatus)}</Badge>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => setEditForm(formFromSession(session))}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Attendance Session</DialogTitle>
                      <DialogDescription>Update session details, status, discipleship fields, or QR expiration.</DialogDescription>
                    </DialogHeader>
                    <SessionFormView
                      form={editForm}
                      setForm={setEditForm}
                      onSubmit={() => updateSession.mutate()}
                      isSubmitting={updateSession.isPending}
                      submitLabel="Save Changes"
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {session.attendanceType === "discipleship" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Total Disciples" value={String(disciplesTotal)} trend="Tagged disciples" />
                <StatCard label="Checked In" value={String(checkedInDisciples)} trend="Present disciples" />
                <StatCard label="Attendance Rate" value={`${sessionQuery.data?.discipleshipAttendanceRate ?? 0}%`} trend={`${checkedInDisciples}/${disciplesTotal} attended`} />
              </div>
            ) : (
              <ServiceAttendanceSummaryCard
                totalPresent={presentRecords.length}
                activeMembers={serviceBreakdown.activeMember}
                members={serviceBreakdown.member}
                visitors={serviceBreakdown.visitor}
              />
            )}
            <div className="grid gap-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Check-In</CardTitle><CardDescription>Members scan and check themselves in while logged in.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {session.qrEnabled ? <img src={qrImage} alt="Attendance QR code" className="mx-auto rounded-md border bg-white p-3" /> : <p className="text-sm text-muted-foreground">QR is disabled.</p>}
                  <p className="break-all rounded-md bg-muted p-2 text-xs">{qrUrl}</p>
                  <p className="text-xs text-muted-foreground">Expires {formatDateTime(session.qrExpiration)}</p>
                  <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">Open Manual Attendance</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Record Attendance</DialogTitle>
                        <DialogDescription>Search member and submit attendance.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input placeholder="Search members" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                        <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Select member</option>
                          {(membersQuery.data?.members ?? []).map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.email}</option>)}
                        </select>
                        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="present">Present</option>
                          {session.attendanceType === "discipleship" && <option value="absent">Absent</option>}
                        </select>
                        <Textarea placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                      </div>
                      <DialogFooter>
                        <Button
                          disabled={!selectedMemberId || markRecord.isPending}
                          onClick={() => {
                            markRecord.mutate();
                            setManualOpen(false);
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Record Attendance
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {session.attendanceType === "discipleship" && (
                    <Dialog open={checkinScreenOpen} onOpenChange={setCheckinScreenOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full">Open Discipleship Check-In Screen</Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Discipleship QR Check-In</DialogTitle>
                          <DialogDescription>{session.sessionName}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                          <div className="space-y-3">
                            {session.qrEnabled ? <img src={qrImage} alt="Discipleship QR code" className="mx-auto rounded-md border bg-white p-3" /> : <p className="text-sm text-muted-foreground">QR is disabled.</p>}
                            <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
                              Attendance: {checkedInDisciples} / {disciplesTotal} ({sessionQuery.data?.discipleshipAttendanceRate ?? 0}%)
                            </p>
                          </div>
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Checked In Names</p>
                            <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-md border p-3">
                              {presentRecords.map((record) => (
                                <div key={record.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                                  <span>{record.memberName}</span>
                                  <span className="text-xs text-muted-foreground">{formatDateTime(record.checkinTime)}</span>
                                </div>
                              ))}
                              {!presentRecords.length && <p className="text-sm text-muted-foreground">No one has checked in yet.</p>}
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Attendance Records</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>Time</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.memberName}</TableCell>
                        <TableCell><Badge variant="secondary">{labelize(record.attendanceStatus)}</Badge></TableCell>
                        <TableCell>{labelize(record.checkinSource)}</TableCell>
                        <TableCell>{formatDateTime(record.checkinTime)}</TableCell>
                        <TableCell>{record.notes ?? ""}</TableCell>
                      </TableRow>
                    ))}
                    {!records.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No records yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : <Card><CardContent className="py-12 text-center text-muted-foreground">Loading attendance session...</CardContent></Card>}
      </div>
    </AdminLayout>
  );
}

function ServiceAttendanceSummaryCard({
  totalPresent,
  activeMembers,
  members,
  visitors,
}: {
  totalPresent: number;
  activeMembers: number;
  members: number;
  visitors: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Attendance Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.3fr)] md:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Attended</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-slate-950">{totalPresent}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">Active</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{activeMembers}</p>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">Members</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{members}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs font-medium text-amber-700">Visitors</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{visitors}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionFormView({ form, setForm, onSubmit, isSubmitting, submitLabel }: { form: SessionForm; setForm: React.Dispatch<React.SetStateAction<SessionForm>>; onSubmit: () => void; isSubmitting: boolean; submitLabel: string }) {
  const set = (key: keyof SessionForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Attendance Type</Label><select value={form.attendanceType} onChange={(event) => set("attendanceType", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="regular_service">Regular Service</option><option value="discipleship">Friday Discipleship</option></select></div>
        <div className="space-y-2"><Label>Session Status</Label><select value={form.sessionStatus} onChange={(event) => set("sessionStatus", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="closed">Closed</option></select></div>
        <TextInput label="Session Name" value={form.sessionName} onChange={(value) => set("sessionName", value)} required />
        <TextInput label="Session Date" type="date" value={form.sessionDate} onChange={(value) => set("sessionDate", value)} required />
        <TextInput label="Start Time" type="time" value={form.startTime} onChange={(value) => set("startTime", value)} />
        <TextInput label="Location / Online" value={form.location} onChange={(value) => set("location", value)} />
        {form.attendanceType === "discipleship" && (
          <>
            <TextInput label="Group / Class Name" value={form.discipleshipGroup} onChange={(value) => set("discipleshipGroup", value)} />
            <TextInput label="Teacher / Leader" value={form.teacherLeader} onChange={(value) => set("teacherLeader", value)} />
            <TextInput label="Lesson Topic" value={form.lessonTopic} onChange={(value) => set("lessonTopic", value)} />
          </>
        )}
        <TextInput label="QR Expiration" type="datetime-local" value={form.qrExpiration} onChange={(value) => set("qrExpiration", value)} required />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.qrEnabled} onChange={(event) => set("qrEnabled", event.target.checked)} /> Enable QR self check-in</label>
      <DialogFooter><Button type="submit" disabled={isSubmitting}>{submitLabel}</Button></DialogFooter>
    </form>
  );
}

function TextInput({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
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

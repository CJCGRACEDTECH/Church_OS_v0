import React from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { readProfilePhotoFile } from "@/lib/profile-photo";
import { ArrowLeft, BarChart3, Mail, Pencil, Phone, Plus, Search, ShieldCheck, UserRound, Users } from "lucide-react";

type MemberStatus = "visitor" | "member" | "active_member";
type WritableMemberStatus = "visitor" | "member";
type BaptismStatus = "baptized" | "not_baptized" | "unknown";
type ServingStatus = "serving" | "not_serving" | "interested";
type PreferredContactMethod = "phone" | "email" | "text";

type Member = {
  id: number;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  profilePhotoUrl: string | null;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  memberStatus: WritableMemberStatus;
  ministryDepartment: string | null;
  joinDate: string | null;
  baptismStatus: BaptismStatus;
  smallGroup: string | null;
  discipleshipParticipant: boolean;
  servingStatus: ServingStatus;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  preferredContactMethod: PreferredContactMethod;
  emergencyContactName: string | null;
  emergencyContactPhoneNumber: string | null;
  emergencyContactRelationship: string | null;
  accountStatus: "active" | "pending" | "disabled";
  invitedAt: string | null;
  inviteAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LinkedChild = {
  id: number;
  firstName: string;
  lastName: string;
  classroom: string | null;
  checkinStatus: "checked_in" | "checked_out";
  relationship: string;
  authorizedPickup: boolean;
};

type MemberAttendanceSummary = {
  totalRecords: number;
  presentRecords: number;
  discipleshipRecords: number;
  recentRecords: Array<{
    id: number;
    sessionId: number;
    sessionName: string;
    attendanceType: "regular_service" | "discipleship";
    sessionDate: string;
    attendanceStatus: string;
    checkinSource: string;
    checkinTime: string;
  }>;
};

type MemberFormState = {
  firstName: string;
  lastName: string;
  preferredName: string;
  profilePhotoUrl: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  memberStatus: MemberStatus;
  ministryDepartment: string;
  joinDate: string;
  baptismStatus: BaptismStatus;
  smallGroup: string;
  discipleshipParticipant: boolean;
  servingStatus: ServingStatus;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  preferredContactMethod: PreferredContactMethod;
  emergencyContactName: string;
  emergencyContactPhoneNumber: string;
  emergencyContactRelationship: string;
};

const emptyMemberForm: MemberFormState = {
  firstName: "",
  lastName: "",
  preferredName: "",
  profilePhotoUrl: "",
  email: "",
  phoneNumber: "",
  dateOfBirth: "",
  gender: "",
  memberStatus: "member",
  ministryDepartment: "",
  joinDate: "",
  baptismStatus: "unknown",
  smallGroup: "",
  discipleshipParticipant: false,
  servingStatus: "not_serving",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  preferredContactMethod: "email",
  emergencyContactName: "",
  emergencyContactPhoneNumber: "",
  emergencyContactRelationship: "",
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const demoToken = sessionStorage.getItem("demo_token");
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(demoToken ? { authorization: `Bearer ${demoToken}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function labelize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function memberStatusClass(status: MemberStatus) {
  if (status === "active_member") return "border-green-200 bg-green-500/10 text-green-700 dark:text-green-400";
  if (status === "member") return "border-blue-200 bg-blue-500/10 text-blue-700 dark:text-blue-400";
  if (status === "visitor") return "border-yellow-200 bg-white text-yellow-700 dark:text-yellow-400";
  return "border-border bg-muted text-muted-foreground";
}

type InviteStatus = "not_invited" | "invited" | "accepted";

function inviteStatus(member: Pick<Member, "invitedAt" | "inviteAcceptedAt">): InviteStatus {
  if (member.inviteAcceptedAt) return "accepted";
  if (member.invitedAt) return "invited";
  return "not_invited";
}

function inviteStatusLabel(status: InviteStatus) {
  if (status === "accepted") return "Accepted";
  if (status === "invited") return "Invited";
  return "Not Invited";
}

function inviteStatusClass(status: InviteStatus) {
  if (status === "accepted") return "border-green-200 bg-green-500/10 text-green-700 dark:text-green-400";
  if (status === "invited") return "border-blue-200 bg-blue-500/10 text-blue-700 dark:text-blue-400";
  return "border-border bg-muted text-muted-foreground";
}

function isVisibleMinistry(department: string) {
  const normalized = department.toLowerCase().replace(/[^a-z]/g, "");
  return normalized !== "youthministries" && normalized !== "youthministry" && normalized !== "smallgroups" && normalized !== "smallgroup";
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Not set" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function memberName(member: Member) {
  return `${member.firstName} ${member.lastName}`;
}

function initials(member: Pick<Member, "firstName" | "lastName">) {
  return `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`;
}

function formFromMember(member: Member): MemberFormState {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    preferredName: member.preferredName ?? "",
    profilePhotoUrl: member.profilePhotoUrl ?? "",
    email: member.email,
    phoneNumber: member.phoneNumber ?? "",
    dateOfBirth: member.dateOfBirth ?? "",
    gender: member.gender ?? "",
    memberStatus: member.memberStatus === "visitor" ? "visitor" : "member",
    ministryDepartment: member.ministryDepartment ?? "",
    joinDate: member.joinDate ?? "",
    baptismStatus: member.baptismStatus,
    smallGroup: member.smallGroup ?? "",
    discipleshipParticipant: member.discipleshipParticipant,
    servingStatus: member.servingStatus,
    streetAddress: member.streetAddress ?? "",
    city: member.city ?? "",
    state: member.state ?? "",
    zipCode: member.zipCode ?? "",
    preferredContactMethod: member.preferredContactMethod,
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactPhoneNumber: member.emergencyContactPhoneNumber ?? "",
    emergencyContactRelationship: member.emergencyContactRelationship ?? "",
  };
}

function payloadFromForm(form: MemberFormState) {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{value || "Not set"}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function MemberForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  isSubmitting,
  sendInvite,
  onSendInviteChange,
}: {
  form: MemberFormState;
  setForm: React.Dispatch<React.SetStateAction<MemberFormState>>;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  sendInvite?: boolean;
  onSendInviteChange?: (value: boolean) => void;
}) {
  const set = (key: keyof MemberFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    const photo = await readProfilePhotoFile(file);
    set("profilePhotoUrl", photo);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormSection title="Basic Account Information" description="Start with the member's identity and primary contact details.">
        <div className="mb-5 flex items-center gap-4">
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={form.profilePhotoUrl || undefined} />
            <AvatarFallback>{form.firstName[0]}{form.lastName[0]}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label htmlFor="profilePhoto">Profile Picture</Label>
            <Input id="profilePhoto" type="file" accept="image/*" capture="user" onChange={(event) => void handlePhoto(event.target.files?.[0])} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="First Name" value={form.firstName} onChange={(value) => set("firstName", value)} required />
          <TextInput label="Last Name" value={form.lastName} onChange={(value) => set("lastName", value)} required />
          <TextInput label="Preferred Name" value={form.preferredName} onChange={(value) => set("preferredName", value)} />
          <TextInput label="Email Address" type="email" value={form.email} onChange={(value) => set("email", value)} required />
          <TextInput label="Phone Number" type="tel" value={form.phoneNumber} onChange={(value) => set("phoneNumber", value)} />
          <SelectField label="Preferred Contact Method" value={form.preferredContactMethod} onChange={(value) => set("preferredContactMethod", value)}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="text">Text</option>
          </SelectField>
          <TextInput label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(value) => set("dateOfBirth", value)} />
          <TextInput label="Gender" value={form.gender} onChange={(value) => set("gender", value)} />
        </div>
      </FormSection>

      <FormSection title="Church Information" description="Track church relationship, discipleship, and serving participation.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Member Status" value={form.memberStatus} onChange={(value) => set("memberStatus", value)}>
            <option value="visitor">Visitor</option>
            <option value="member">Member</option>
          </SelectField>
          <TextInput label="Join Date" type="date" value={form.joinDate} onChange={(value) => set("joinDate", value)} />
          <TextInput label="Ministry / Department" value={form.ministryDepartment} onChange={(value) => set("ministryDepartment", value)} />
          <SelectField label="Serving Status" value={form.servingStatus} onChange={(value) => set("servingStatus", value)}>
            <option value="not_serving">Not Serving</option>
            <option value="serving">Serving</option>
            <option value="interested">Interested</option>
          </SelectField>
          <SelectField label="Baptism Status" value={form.baptismStatus} onChange={(value) => set("baptismStatus", value)}>
            <option value="unknown">Unknown</option>
            <option value="baptized">Baptized</option>
            <option value="not_baptized">Not Baptized</option>
          </SelectField>
          <TextInput label="Small Group / Cell Group" value={form.smallGroup} onChange={(value) => set("smallGroup", value)} />
          <div className="space-y-2 md:col-span-2">
            <Label>Discipleship Participant</Label>
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.discipleshipParticipant}
                onChange={(event) => setForm((current) => ({ ...current, discipleshipParticipant: event.target.checked }))}
              />
              Mark member as disciple
            </label>
          </div>
        </div>
      </FormSection>

      <FormSection title="Address Information">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Street Address" value={form.streetAddress} onChange={(value) => set("streetAddress", value)} />
          <TextInput label="City" value={form.city} onChange={(value) => set("city", value)} />
          <TextInput label="State" value={form.state} onChange={(value) => set("state", value)} />
          <TextInput label="Zip Code" value={form.zipCode} onChange={(value) => set("zipCode", value)} />
        </div>
      </FormSection>

      <FormSection title="Emergency Contact">
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput label="Contact Name" value={form.emergencyContactName} onChange={(value) => set("emergencyContactName", value)} />
          <TextInput label="Contact Phone" type="tel" value={form.emergencyContactPhoneNumber} onChange={(value) => set("emergencyContactPhoneNumber", value)} />
          <TextInput label="Relationship" value={form.emergencyContactRelationship} onChange={(value) => set("emergencyContactRelationship", value)} />
        </div>
      </FormSection>

      {onSendInviteChange && (
        <FormSection title="Account Invitation" description="Send an invitation after saving the profile, or add the profile without account access for now.">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(sendInvite)}
              onChange={(event) => onSendInviteChange(event.target.checked)}
            />
            <span>
              <span className="font-medium">Send account invitation</span>
              <span className="mt-1 block text-muted-foreground">
                Creates the profile now and emails the member a sign-in link so they can activate their account with this email address.
              </span>
            </span>
          </label>
        </FormSection>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

export default function AdminMembers() {
  const [, params] = useRoute("/admin/members/:id");
  return params?.id ? <MemberProfile memberId={Number(params.id)} /> : <MembersDirectory />;
}

function MembersDirectory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = React.useState("");
  const [memberStatus, setMemberStatus] = React.useState("");
  const [ministryDepartment, setMinistryDepartment] = React.useState("");
  const [servingStatus, setServingStatus] = React.useState("");
  const [baptismStatus, setBaptismStatus] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState<MemberFormState>(emptyMemberForm);
  const [sendInvite, setSendInvite] = React.useState(true);
  const canEdit = user?.adminPermissions?.includes(PERMISSIONS.MEMBER_PROFILES) ?? false;

  const membersQuery = useQuery({
    queryKey: ["members-directory", search, memberStatus, ministryDepartment, servingStatus, baptismStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (memberStatus) params.set("memberStatus", memberStatus);
      if (ministryDepartment) params.set("ministryDepartment", ministryDepartment);
      if (servingStatus) params.set("servingStatus", servingStatus);
      if (baptismStatus) params.set("baptismStatus", baptismStatus);
      const query = params.toString();
      return apiJson<{ members: Member[]; filters: { ministryDepartments: string[] } }>(`/admin/members${query ? `?${query}` : ""}`);
    },
  });

  const createMember = useMutation({
    mutationFn: () => apiJson<{ member: Member; inviteSent: boolean; inviteUrl: string | null }>("/admin/members", {
      method: "POST",
      body: JSON.stringify({ ...payloadFromForm(form), sendInvite }),
    }),
    onSuccess: (data) => {
      setAddOpen(false);
      setForm(emptyMemberForm);
      setSendInvite(true);
      toast({ title: data.inviteSent ? "Member invited" : "Member added" });
      void queryClient.invalidateQueries({ queryKey: ["members-directory"] });
      setLocation(`/admin/members/${data.member.id}`);
    },
    onError: (error) => toast({ title: "Could not add member", description: error.message, variant: "destructive" }),
  });

  const members = membersQuery.data?.members ?? [];
  const departments = (membersQuery.data?.filters.ministryDepartments ?? []).filter(isVisibleMinistry);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">People</p>
            <h1 className="text-3xl font-semibold tracking-tight">Members Directory</h1>
          </div>
          {canEdit && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setForm(emptyMemberForm); setSendInvite(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Member</DialogTitle>
                  <DialogDescription>Enter member details manually and optionally send an account invitation. Admin roles cannot be assigned here.</DialogDescription>
                </DialogHeader>
                <MemberForm
                  form={form}
                  setForm={setForm}
                  onSubmit={() => createMember.mutate()}
                  submitLabel={sendInvite ? "Add & Invite Member" : "Add Member"}
                  isSubmitting={createMember.isPending}
                  sendInvite={sendInvite}
                  onSendInviteChange={setSendInvite}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Directory
            </CardTitle>
            <CardDescription>Search and filter member records without exposing giving information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.5fr_repeat(4,1fr)]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search name, email, or phone" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <FilterSelect value={memberStatus} onChange={setMemberStatus} placeholder="All statuses">
                <option value="visitor">Visitor</option>
                <option value="member">Member</option>
              </FilterSelect>
              <FilterSelect value={ministryDepartment} onChange={setMinistryDepartment} placeholder="All ministries">
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </FilterSelect>
              <FilterSelect value={servingStatus} onChange={setServingStatus} placeholder="All serving">
                <option value="serving">Serving</option>
                <option value="not_serving">Not Serving</option>
                <option value="interested">Interested</option>
              </FilterSelect>
              <FilterSelect value={baptismStatus} onChange={setBaptismStatus} placeholder="All baptism">
                <option value="baptized">Baptized</option>
                <option value="not_baptized">Not Baptized</option>
                <option value="unknown">Unknown</option>
              </FilterSelect>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invite Status</TableHead>
                    <TableHead>Ministry / Department</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} className="cursor-pointer" onClick={() => setLocation(`/admin/members/${member.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.profilePhotoUrl ?? undefined} />
                            <AvatarFallback>{initials(member)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{memberName(member)}</p>
                            {member.preferredName && <p className="text-xs text-muted-foreground">Preferred: {member.preferredName}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phoneNumber ?? "Not set"}</TableCell>
                      <TableCell><Badge variant="outline" className={memberStatusClass(member.memberStatus)}>{labelize(member.memberStatus)}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={inviteStatusClass(inviteStatus(member))}>{inviteStatusLabel(inviteStatus(member))}</Badge></TableCell>
                      <TableCell>{member.ministryDepartment ?? "Not set"}</TableCell>
                      <TableCell>{formatDateTime(member.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!members.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        {membersQuery.isLoading ? "Loading members..." : "No members found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function MemberProfile({ memberId }: { memberId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<MemberFormState>(emptyMemberForm);
  const canEdit = user?.adminPermissions?.includes(PERMISSIONS.MEMBER_PROFILES) ?? false;

  const profileQuery = useQuery({
    queryKey: ["member-profile", memberId],
    queryFn: () => apiJson<{ member: Member; children: LinkedChild[]; attendance: MemberAttendanceSummary }>(`/admin/members/${memberId}`),
  });

  const updateMember = useMutation({
    mutationFn: () => apiJson<{ member: Member }>(`/admin/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(payloadFromForm(form)),
    }),
    onSuccess: (data) => {
      setEditOpen(false);
      setForm(formFromMember(data.member));
      toast({ title: "Member updated" });
      void queryClient.invalidateQueries({ queryKey: ["member-profile", memberId] });
      void queryClient.invalidateQueries({ queryKey: ["members-directory"] });
    },
    onError: (error) => toast({ title: "Could not update member", description: error.message, variant: "destructive" }),
  });

  React.useEffect(() => {
    if (profileQuery.data?.member) setForm(formFromMember(profileQuery.data.member));
  }, [profileQuery.data?.member]);

  const member = profileQuery.data?.member;
  const children = profileQuery.data?.children ?? [];
  const attendance = profileQuery.data?.attendance;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <Button variant="ghost" className="w-fit px-0" asChild>
              <Link href="/admin/members">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Members Directory
              </Link>
            </Button>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Member Profile</p>
              <h1 className="text-3xl font-semibold tracking-tight">{member ? memberName(member) : "Loading member"}</h1>
            </div>
          </div>
          {member && canEdit && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm(formFromMember(member))}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Member</DialogTitle>
                  <DialogDescription>Update member profile details. Admin role and giving data are not managed here.</DialogDescription>
                </DialogHeader>
                <MemberForm form={form} setForm={setForm} onSubmit={() => updateMember.mutate()} submitLabel="Save Changes" isSubmitting={updateMember.isPending} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {member ? (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border">
                      <AvatarImage src={member.profilePhotoUrl ?? undefined} />
                      <AvatarFallback>{initials(member)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-2xl font-semibold">{memberName(member)}</h2>
                      <p className="text-sm text-muted-foreground">{member.preferredName ? `Preferred: ${member.preferredName}` : "No preferred name set"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className={memberStatusClass(member.memberStatus)}>{labelize(member.memberStatus)}</Badge>
                        <Badge variant="secondary">{labelize(member.servingStatus)}</Badge>
                        <Badge variant="outline">{labelize(member.baptismStatus)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground" href={`mailto:${member.email}`}>
                      <Mail className="h-4 w-4" />
                      {member.email}
                    </a>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {member.phoneNumber ?? "No phone number"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Basic Info</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="Date of Birth" value={formatDate(member.dateOfBirth)} />
                  <Field label="Gender" value={member.gender} />
                  <Field label="Preferred Contact" value={labelize(member.preferredContactMethod)} />
                  <Field label="Last Updated" value={formatDateTime(member.updatedAt)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Church Info</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="Ministry / Department" value={member.ministryDepartment} />
                  <Field label="Join Date" value={formatDate(member.joinDate)} />
                  <Field label="Small Group / Cell Group" value={member.smallGroup} />
                  <Field label="Serving Status" value={labelize(member.servingStatus)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Info</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="Street Address" value={member.streetAddress} />
                  <Field label="City" value={member.city} />
                  <Field label="State" value={member.state} />
                  <Field label="Zip Code" value={member.zipCode} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="Name" value={member.emergencyContactName} />
                  <Field label="Phone" value={member.emergencyContactPhoneNumber} />
                  <Field label="Relationship" value={member.emergencyContactRelationship} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Attendance & Engagement</CardTitle>
                <CardDescription>Recent service and discipleship attendance records for this member.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Recent Records</p>
                    <p className="text-2xl font-semibold">{attendance?.totalRecords ?? 0}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Present</p>
                    <p className="text-2xl font-semibold">{attendance?.presentRecords ?? 0}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Discipleship</p>
                    <p className="text-2xl font-semibold">{attendance?.discipleshipRecords ?? 0}</p>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check-In</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance?.recentRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="font-medium">{record.sessionName}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(record.sessionDate)}</div>
                          </TableCell>
                          <TableCell>{labelize(record.attendanceType)}</TableCell>
                          <TableCell><Badge variant={record.attendanceStatus === "present" ? "default" : "secondary"}>{labelize(record.attendanceStatus)}</Badge></TableCell>
                          <TableCell>{formatDateTime(record.checkinTime)}</TableCell>
                        </TableRow>
                      ))}
                      {!attendance?.recentRecords.length && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No attendance records found for this member yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Linked Children</CardTitle>
                <CardDescription>Matched by parent or guardian contact information from Children Ministry.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {children.map((child) => (
                    <div key={child.id} className="rounded-md border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{child.firstName} {child.lastName}</p>
                          <p className="text-sm text-muted-foreground">{child.classroom ?? "No classroom"} · {labelize(child.relationship)}</p>
                        </div>
                        <Badge variant={child.checkinStatus === "checked_in" ? "default" : "secondary"}>{labelize(child.checkinStatus)}</Badge>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {child.authorizedPickup ? "Authorized pickup contact" : "Not authorized for pickup"}
                      </p>
                    </div>
                  ))}
                  {!children.length && <p className="text-sm text-muted-foreground">No linked children found for this member.</p>}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {profileQuery.isLoading ? "Loading member profile..." : "Member profile could not be loaded."}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

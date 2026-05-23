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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { readProfilePhotoFile } from "@/lib/profile-photo";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Baby,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";

type MemberStatus = "visitor" | "member" | "active_member" | "inactive";
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
  memberStatus: MemberStatus;
  ministryDepartment: string | null;
  joinDate: string | null;
  baptismStatus: BaptismStatus;
  smallGroup: string | null;
  servingStatus: ServingStatus;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  preferredContactMethod: PreferredContactMethod;
  emergencyContactName: string | null;
  emergencyContactPhoneNumber: string | null;
  emergencyContactRelationship: string | null;
  createdAt: string;
  updatedAt: string;
};

type LinkedChild = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  classroom: string | null;
  checkinStatus: "checked_in" | "checked_out";
  relationship: string;
  authorizedPickup: boolean;
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

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function memberName(member: Pick<Member, "firstName" | "lastName">) {
  return `${member.firstName} ${member.lastName}`;
}

function initials(member: Pick<Member, "firstName" | "lastName">) {
  return `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`;
}

function childAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "";
  const born = new Date(`${dateOfBirth}T12:00:00`);
  const now = new Date();
  const age = now.getFullYear() - born.getFullYear() - (
    now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate()) ? 1 : 0
  );
  return `Age ${age}`;
}

function statusBadgeClass(status: MemberStatus): string {
  switch (status) {
    case "visitor": return "bg-amber-100 text-amber-800 border-amber-200";
    case "member": return "bg-blue-100 text-blue-800 border-blue-200";
    case "active_member": return "bg-green-100 text-green-800 border-green-200";
    case "inactive": return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge variant="outline" className={statusBadgeClass(status)}>
      {labelize(status)}
    </Badge>
  );
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
    memberStatus: member.memberStatus,
    ministryDepartment: member.ministryDepartment ?? "",
    joinDate: member.joinDate ?? "",
    baptismStatus: member.baptismStatus,
    smallGroup: member.smallGroup ?? "",
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
      <div className="mt-1 text-sm text-foreground">{value || <span className="text-muted-foreground">Not set</span>}</div>
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
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function MemberForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  isSubmitting,
}: {
  form: MemberFormState;
  setForm: React.Dispatch<React.SetStateAction<MemberFormState>>;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting: boolean;
}) {
  const set = (key: keyof MemberFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    const photo = await readProfilePhotoFile(file);
    set("profilePhotoUrl", photo);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="church">Church Info</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 pt-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={form.profilePhotoUrl || undefined} />
              <AvatarFallback>{form.firstName[0]}{form.lastName[0]}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="profilePhoto">Profile Picture</Label>
              <Input id="profilePhoto" type="file" accept="image/*" onChange={(event) => void handlePhoto(event.target.files?.[0])} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="First Name" value={form.firstName} onChange={(value) => set("firstName", value)} required />
            <TextInput label="Last Name" value={form.lastName} onChange={(value) => set("lastName", value)} required />
            <TextInput label="Preferred Name" value={form.preferredName} onChange={(value) => set("preferredName", value)} />
            <TextInput label="Email Address" type="email" value={form.email} onChange={(value) => set("email", value)} required />
            <TextInput label="Phone Number" type="tel" value={form.phoneNumber} onChange={(value) => set("phoneNumber", value)} />
            <TextInput label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(value) => set("dateOfBirth", value)} />
            <TextInput label="Gender" value={form.gender} onChange={(value) => set("gender", value)} />
          </div>
        </TabsContent>

        <TabsContent value="church" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Member Status" value={form.memberStatus} onChange={(value) => set("memberStatus", value)}>
              <option value="visitor">Visitor</option>
              <option value="member">Member</option>
              <option value="active_member">Active Member</option>
              <option value="inactive">Inactive</option>
            </SelectField>
            <TextInput label="Ministry / Department" value={form.ministryDepartment} onChange={(value) => set("ministryDepartment", value)} />
            <TextInput label="Join Date" type="date" value={form.joinDate} onChange={(value) => set("joinDate", value)} />
            <SelectField label="Baptism Status" value={form.baptismStatus} onChange={(value) => set("baptismStatus", value)}>
              <option value="unknown">Unknown</option>
              <option value="baptized">Baptized</option>
              <option value="not_baptized">Not Baptized</option>
            </SelectField>
            <TextInput label="Small Group / Cell Group" value={form.smallGroup} onChange={(value) => set("smallGroup", value)} />
            <SelectField label="Serving Status" value={form.servingStatus} onChange={(value) => set("servingStatus", value)}>
              <option value="not_serving">Not Serving</option>
              <option value="serving">Serving</option>
              <option value="interested">Interested</option>
            </SelectField>
            <SelectField label="Preferred Contact" value={form.preferredContactMethod} onChange={(value) => set("preferredContactMethod", value)}>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="text">Text</option>
            </SelectField>
          </div>
        </TabsContent>

        <TabsContent value="address" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextInput label="Street Address" value={form.streetAddress} onChange={(value) => set("streetAddress", value)} />
            </div>
            <TextInput label="City" value={form.city} onChange={(value) => set("city", value)} />
            <TextInput label="State" value={form.state} onChange={(value) => set("state", value)} />
            <TextInput label="Zip Code" value={form.zipCode} onChange={(value) => set("zipCode", value)} />
          </div>
        </TabsContent>

        <TabsContent value="emergency" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">In case of emergency, who should we contact?</p>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Contact Name" value={form.emergencyContactName} onChange={(value) => set("emergencyContactName", value)} />
            <TextInput label="Contact Phone" type="tel" value={form.emergencyContactPhoneNumber} onChange={(value) => set("emergencyContactPhoneNumber", value)} />
            <TextInput label="Relationship" value={form.emergencyContactRelationship} onChange={(value) => set("emergencyContactRelationship", value)} />
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
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

function SortableHead({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onClick,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentOrder: "asc" | "desc";
  onClick: (key: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onClick(sortKey)}>
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          currentOrder === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
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
  const [sortBy, setSortBy] = React.useState("lastName");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState<MemberFormState>(emptyMemberForm);
  const canEdit = user?.adminPermissions?.includes(PERMISSIONS.MEMBER_PROFILES) ?? false;

  const hasFilters = Boolean(search || memberStatus || ministryDepartment || servingStatus || baptismStatus);

  function clearFilters() {
    setSearch("");
    setMemberStatus("");
    setMinistryDepartment("");
    setServingStatus("");
    setBaptismStatus("");
  }

  function toggleSort(key: string) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  }

  const membersQuery = useQuery({
    queryKey: ["members-directory", search, memberStatus, ministryDepartment, servingStatus, baptismStatus, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (memberStatus) params.set("memberStatus", memberStatus);
      if (ministryDepartment) params.set("ministryDepartment", ministryDepartment);
      if (servingStatus) params.set("servingStatus", servingStatus);
      if (baptismStatus) params.set("baptismStatus", baptismStatus);
      params.set("sortBy", sortBy);
      params.set("order", sortOrder);
      return apiJson<{ members: Member[]; filters: { ministryDepartments: string[] } }>(`/admin/members?${params.toString()}`);
    },
  });

  const createMember = useMutation({
    mutationFn: () => apiJson<{ member: Member }>("/admin/members", {
      method: "POST",
      body: JSON.stringify(payloadFromForm(form)),
    }),
    onSuccess: (data) => {
      setAddOpen(false);
      setForm(emptyMemberForm);
      toast({ title: "Member added" });
      void queryClient.invalidateQueries({ queryKey: ["members-directory"] });
      setLocation(`/admin/members/${data.member.id}`);
    },
    onError: (error) => toast({ title: "Could not add member", description: error.message, variant: "destructive" }),
  });

  async function downloadCsv() {
    try {
      const demoToken = sessionStorage.getItem("demo_token");
      const response = await fetch("/api/admin/members/export.csv", {
        credentials: "include",
        headers: demoToken ? { authorization: `Bearer ${demoToken}` } : {},
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Could not download member data.", variant: "destructive" });
    }
  }

  const members = membersQuery.data?.members ?? [];
  const departments = membersQuery.data?.filters.ministryDepartments ?? [];

  const counts = members.reduce(
    (acc, m) => {
      acc[m.memberStatus] = (acc[m.memberStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<MemberStatus, number>,
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">People</p>
            <h1 className="text-3xl font-semibold tracking-tight">Members Directory</h1>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => void downloadCsv()}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            )}
            {canEdit && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setForm(emptyMemberForm)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Member</DialogTitle>
                    <DialogDescription>Create a member profile. Admin roles cannot be assigned here.</DialogDescription>
                  </DialogHeader>
                  <MemberForm form={form} setForm={setForm} onSubmit={() => createMember.mutate()} submitLabel="Add Member" isSubmitting={createMember.isPending} />
                </DialogContent>
              </Dialog>
            )}
          </div>
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
                <option value="active_member">Active Member</option>
                <option value="inactive">Inactive</option>
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

            {membersQuery.isError && (
              <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Could not load members.</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => membersQuery.refetch()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            )}

            {!membersQuery.isError && !membersQuery.isLoading && members.length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {counts.active_member !== undefined && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    {counts.active_member} Active
                  </span>
                )}
                {counts.member !== undefined && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {counts.member} Member
                  </span>
                )}
                {counts.visitor !== undefined && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {counts.visitor} {counts.visitor === 1 ? "Visitor" : "Visitors"}
                  </span>
                )}
                {counts.inactive !== undefined && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                    {counts.inactive} Inactive
                  </span>
                )}
                <span className="ml-auto font-medium text-foreground">{members.length} total</span>
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Name" sortKey="lastName" currentSort={sortBy} currentOrder={sortOrder} onClick={toggleSort} />
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ministry / Department</TableHead>
                    <SortableHead label="Join Date" sortKey="joinDate" currentSort={sortBy} currentOrder={sortOrder} onClick={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersQuery.isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      </TableRow>
                    ))}

                  {!membersQuery.isLoading && members.map((member) => (
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
                      <TableCell>{member.phoneNumber ?? <span className="text-muted-foreground">Not set</span>}</TableCell>
                      <TableCell><StatusBadge status={member.memberStatus} /></TableCell>
                      <TableCell>{member.ministryDepartment ?? <span className="text-muted-foreground">Not set</span>}</TableCell>
                      <TableCell>{member.joinDate ? formatDate(member.joinDate) : <span className="text-muted-foreground">Not set</span>}</TableCell>
                    </TableRow>
                  ))}

                  {!membersQuery.isLoading && !membersQuery.isError && members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Users className="h-8 w-8 opacity-40" />
                          <p className="font-medium">
                            {hasFilters ? "No members match your filters." : "No members found."}
                          </p>
                          {hasFilters && (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          )}
                          {!hasFilters && canEdit && (
                            <Button size="sm" onClick={() => { setForm(emptyMemberForm); setAddOpen(true); }}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add first member
                            </Button>
                          )}
                        </div>
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

function MemberProfile({ memberId }: { memberId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [smsOpen, setSmsOpen] = React.useState(false);
  const [smsMessage, setSmsMessage] = React.useState("");
  const [form, setForm] = React.useState<MemberFormState>(emptyMemberForm);
  const canEdit = user?.adminPermissions?.includes(PERMISSIONS.MEMBER_PROFILES) ?? false;

  const profileQuery = useQuery({
    queryKey: ["member-profile", memberId],
    queryFn: () => apiJson<{ member: Member; children: LinkedChild[] }>(`/admin/members/${memberId}`),
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

  const convertToMember = useMutation({
    mutationFn: (current: Member) =>
      apiJson<{ member: Member }>(`/admin/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payloadFromForm(formFromMember(current)),
          memberStatus: "active_member",
          joinDate: new Date().toISOString().slice(0, 10),
        }),
      }),
    onSuccess: () => {
      toast({ title: "Converted to Active Member", description: "Member status updated and join date set to today." });
      void queryClient.invalidateQueries({ queryKey: ["member-profile", memberId] });
      void queryClient.invalidateQueries({ queryKey: ["members-directory"] });
    },
    onError: (error) => toast({ title: "Could not convert member", description: error.message, variant: "destructive" }),
  });

  const sendSms = useMutation({
    mutationFn: () => apiJson<{ ok: boolean; notConfigured?: boolean }>(`/admin/members/${memberId}/sms`, {
      method: "POST",
      body: JSON.stringify({ message: smsMessage }),
    }),
    onSuccess: (data) => {
      if (data.notConfigured) {
        toast({ title: "SMS not configured", description: "Add Twilio credentials to enable SMS.", variant: "destructive" });
      } else {
        toast({ title: "SMS sent" });
        setSmsMessage("");
        setSmsOpen(false);
      }
    },
    onError: (error) => toast({ title: "Could not send SMS", description: error.message, variant: "destructive" }),
  });

  React.useEffect(() => {
    if (profileQuery.data?.member) setForm(formFromMember(profileQuery.data.member));
  }, [profileQuery.data?.member]);

  const member = profileQuery.data?.member;
  const children = profileQuery.data?.children ?? [];

  return (
    <AdminLayout>
      <TooltipProvider>
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
                <h1 className="text-3xl font-semibold tracking-tight">
                  {member ? memberName(member) : "Loading…"}
                </h1>
              </div>
            </div>

            {member && (
              <div className="flex flex-wrap items-center gap-2">
                {member.memberStatus === "visitor" && canEdit && (
                  <Button
                    variant="outline"
                    className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                    disabled={convertToMember.isPending}
                    onClick={() => convertToMember.mutate(member)}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {convertToMember.isPending ? "Converting…" : "Convert to Member"}
                  </Button>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={!member.phoneNumber ? 0 : undefined}>
                      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" disabled={!member.phoneNumber}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Send SMS
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Send SMS to {memberName(member)}</DialogTitle>
                            <DialogDescription>
                              Message will be sent to {member.phoneNumber}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Type your message…"
                              rows={4}
                              value={smsMessage}
                              onChange={(e) => setSmsMessage(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">{smsMessage.length} / 160 characters</p>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSmsOpen(false)}>Cancel</Button>
                            <Button disabled={!smsMessage.trim() || sendSms.isPending} onClick={() => sendSms.mutate()}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              {sendSms.isPending ? "Sending…" : "Send Message"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </span>
                  </TooltipTrigger>
                  {!member.phoneNumber && (
                    <TooltipContent>No phone number on file</TooltipContent>
                  )}
                </Tooltip>

                {canEdit && (
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setForm(formFromMember(member))}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Member</DialogTitle>
                        <DialogDescription>Update member profile details. Admin role and giving data are not managed here.</DialogDescription>
                      </DialogHeader>
                      <MemberForm form={form} setForm={setForm} onSubmit={() => updateMember.mutate()} submitLabel="Save Changes" isSubmitting={updateMember.isPending} />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </div>

          {profileQuery.isError && (
            <Card>
              <CardContent className="flex items-center gap-4 py-10">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-medium">Profile could not be loaded.</p>
                  <p className="text-sm text-muted-foreground">There was an error fetching this member's profile.</p>
                </div>
                <Button variant="outline" className="ml-auto" onClick={() => profileQuery.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {profileQuery.isLoading && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {member && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-20 w-20 border">
                        <AvatarImage src={member.profilePhotoUrl ?? undefined} />
                        <AvatarFallback className="text-lg">{initials(member)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-2xl font-semibold">{memberName(member)}</h2>
                        {member.preferredName && (
                          <p className="text-sm text-muted-foreground">Preferred: {member.preferredName}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge status={member.memberStatus} />
                          {member.servingStatus === "serving" && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                              Serving
                            </Badge>
                          )}
                          {member.servingStatus === "interested" && (
                            <Badge variant="secondary">Interested in Serving</Badge>
                          )}
                          <Badge variant="outline">{labelize(member.baptismStatus)}</Badge>
                          {member.ministryDepartment && (
                            <Badge variant="secondary">{member.ministryDepartment}</Badge>
                          )}
                          {member.smallGroup && (
                            <Badge variant="outline">{member.smallGroup}</Badge>
                          )}
                        </div>
                        {member.joinDate && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {member.memberStatus === "visitor"
                              ? `Visiting since ${formatDate(member.joinDate)}`
                              : `Member since ${formatDate(member.joinDate)}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground" href={`mailto:${member.email}`}>
                        <Mail className="h-4 w-4" />
                        {member.email}
                      </a>
                      {member.phoneNumber ? (
                        <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground" href={`tel:${member.phoneNumber}`}>
                          <Phone className="h-4 w-4" />
                          {member.phoneNumber}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 text-muted-foreground/60">
                          <Phone className="h-4 w-4" />
                          No phone number
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserRound className="h-5 w-5" /> Personal Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="Date of Birth" value={formatDate(member.dateOfBirth)} />
                    <Field label="Gender" value={member.gender ? labelize(member.gender) : null} />
                    <Field label="Preferred Contact" value={labelize(member.preferredContactMethod)} />
                    <Field label="Last Updated" value={formatDateTime(member.updatedAt)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" /> Church Info
                    </CardTitle>
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
                    <div className="md:col-span-2">
                      <Field
                        label="Address"
                        value={[member.streetAddress, member.city, member.state, member.zipCode].filter(Boolean).join(", ") || null}
                      />
                    </div>
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

              {children.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Baby className="h-5 w-5" /> Linked Children
                    </CardTitle>
                    <CardDescription>Matched by parent or guardian contact information from Children Ministry.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {children.map((child) => (
                        <div key={child.id} className="rounded-md border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{child.firstName} {child.lastName}</p>
                              <p className="text-sm text-muted-foreground">
                                {[child.classroom ?? "No classroom", childAge(child.dateOfBirth), labelize(child.relationship)].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <Badge variant={child.checkinStatus === "checked_in" ? "default" : "secondary"}>
                              {labelize(child.checkinStatus)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {child.authorizedPickup ? "✓ Authorized for pickup" : "Not authorized for pickup"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
}

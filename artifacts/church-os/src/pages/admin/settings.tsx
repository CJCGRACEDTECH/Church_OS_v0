import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_LEVELS, PERMISSIONS, type AdminLevel } from "@/lib/permissions";
import {
  Bell,
  CalendarDays,
  Church,
  CreditCard,
  Lock,
  Mail,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";

type PermissionCatalogItem = { key: string; label: string; description: string };
type AdminUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  adminLevel: AdminLevel;
  adminTitle: string;
  assignedMinistry: string | null;
  accountStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  permissions: string[];
};
type AdminInvitation = {
  id: number;
  name: string;
  email: string;
  adminTitle: string;
  assignedMinistry: string | null;
  permissions: string[];
  status: string;
  sentAt: string;
  expiresAt: string;
};
type ChurchProfile = {
  churchName: string;
  churchLogoUrl: string | null;
  churchAddress: string | null;
  churchPhoneNumber: string | null;
  churchEmail: string | null;
  websiteUrl: string | null;
  churchEin: string | null;
  timezone: string;
  defaultLanguage: string;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  defaultZoomLink: string | null;
};
type SettingsPayload = Record<string, unknown>;

const NAV = [
  { id: "general", label: "General", icon: Church },
  { id: "admins", label: "Admins", icon: Users },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "services", label: "Services & Events", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: SlidersHorizontal },
  { id: "giving", label: "Giving", icon: CreditCard },
  { id: "children", label: "Children Ministry", icon: UserCog },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Mail },
  { id: "security", label: "Security", icon: Lock },
  { id: "system", label: "System", icon: Settings },
] as const;

const GROUP_LABELS: Record<string, string> = {
  services: "Services & Events Settings",
  attendance: "Attendance Settings",
  giving: "Giving & Stripe Settings",
  children: "Children Ministry Settings",
  notifications: "Notifications",
  integrations: "Integrations",
  security: "Security",
  system: "System Preferences",
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

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown) {
  return value === true;
}

function numberText(value: unknown) {
  return typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function dateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialSection = new URLSearchParams(window.location.search).get("section");
  const [active, setActive] = React.useState<(typeof NAV)[number]["id"]>(
    NAV.some((item) => item.id === initialSection) ? initialSection as (typeof NAV)[number]["id"] : "general",
  );
  const [selectedAdminId, setSelectedAdminId] = React.useState<number | null>(null);
  const [draftPermissions, setDraftPermissions] = React.useState<string[]>([]);

  const isSuperAdmin = user?.adminLevel === ADMIN_LEVELS.SUPER_ADMIN;
  const canManageAdmins = isSuperAdmin && user?.adminPermissions?.includes(PERMISSIONS.ADMIN_MANAGEMENT);

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiJson<{ churchProfile: ChurchProfile; settings: Record<string, SettingsPayload> }>("/admin/settings"),
  });
  const catalogQuery = useQuery({
    queryKey: ["admin-permission-catalog"],
    queryFn: () => apiJson<{ permissions: PermissionCatalogItem[]; defaults: Record<AdminLevel, string[]> }>("/admin/permission-catalog"),
  });
  const adminsQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiJson<{ admins: AdminUser[] }>("/admin/users"),
  });
  const invitationsQuery = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: () => apiJson<{ invitations: AdminInvitation[] }>("/admin/invitations"),
    enabled: canManageAdmins,
  });
  const activityQuery = useQuery({
    queryKey: ["admin-activity-log"],
    queryFn: () => apiJson<{ log: Array<{ type: string; label: string; detail: string; status: string }> }>("/admin/activity-log"),
    enabled: canManageAdmins,
  });

  const saveChurchProfile = useMutation({
    mutationFn: (profile: ChurchProfile) => apiJson<{ churchProfile: ChurchProfile }>("/admin/settings/church-profile", { method: "PATCH", body: JSON.stringify(profile) }),
    onSuccess: () => {
      toast({ title: "Church profile saved" });
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => toast({ title: "Could not save profile", description: error.message, variant: "destructive" }),
  });

  const saveGroup = useMutation({
    mutationFn: ({ group, settings }: { group: string; settings: SettingsPayload }) => apiJson(`/admin/settings/groups/${group}`, { method: "PATCH", body: JSON.stringify({ settings }) }),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => toast({ title: "Could not save settings", description: error.message, variant: "destructive" }),
  });

  const updatePermissions = useMutation({
    mutationFn: (payload: { adminId: number; permissions: string[] }) => apiJson<{ permissions: string[] }>(`/admin/users/${payload.adminId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: payload.permissions }),
    }),
    onSuccess: () => {
      toast({ title: "Permissions updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => toast({ title: "Permission update failed", description: error.message, variant: "destructive" }),
  });

  const updateAdmin = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<AdminUser> }) => apiJson(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
    onSuccess: () => {
      toast({ title: "Admin updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => toast({ title: "Could not update admin", description: error.message, variant: "destructive" }),
  });

  const removeAdminAccess = useMutation({
    mutationFn: (id: number) => apiJson(`/admin/users/${id}/admin-access`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Admin access removed" });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => toast({ title: "Could not remove access", description: error.message, variant: "destructive" }),
  });

  const inviteAdmin = useMutation({
    mutationFn: (formData: FormData) => {
      const adminLevel = String(formData.get("adminLevel")) as AdminLevel;
      const permissions = draftPermissions.length > 0 ? draftPermissions : catalogQuery.data?.defaults[adminLevel] ?? [];
      return apiJson("/admin/invitations", {
        method: "POST",
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          adminLevel,
          assignedMinistry: formData.get("assignedMinistry"),
          permissions,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Admin invitation sent" });
      setDraftPermissions([]);
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
    onError: (error) => toast({ title: "Invite failed", description: error.message, variant: "destructive" }),
  });

  const admins = adminsQuery.data?.admins ?? [];
  const selectedAdmin = admins.find((admin) => admin.id === selectedAdminId) ?? admins[0];
  const settings = settingsQuery.data?.settings ?? {};

  function togglePermission(admin: AdminUser, permission: string, checked: boolean) {
    const next = checked ? Array.from(new Set([...admin.permissions, permission])) : admin.permissions.filter((item) => item !== permission);
    updatePermissions.mutate({ adminId: admin.id, permissions: next });
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Administration</p>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          </div>
          <Badge variant={isSuperAdmin ? "default" : "outline"}>{isSuperAdmin ? "Super Admin" : "Permission Controlled"}</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          <Card className="h-fit">
            <CardContent className="p-3">
              <nav className="space-y-1">
                {NAV.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(item.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${active === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {active === "general" && settingsQuery.data?.churchProfile && (
              <ChurchProfileSection profile={settingsQuery.data.churchProfile} onSave={(profile) => saveChurchProfile.mutate(profile)} isSaving={saveChurchProfile.isPending} />
            )}
            {active === "admins" && (
              <AdminsSection
                admins={admins}
                invitations={invitationsQuery.data?.invitations ?? []}
                activity={activityQuery.data?.log ?? []}
                canManage={canManageAdmins}
                onInvite={(formData) => inviteAdmin.mutate(formData)}
                onUpdate={(id, updates) => updateAdmin.mutate({ id, updates })}
                onRemove={(id) => removeAdminAccess.mutate(id)}
                isSaving={inviteAdmin.isPending || updateAdmin.isPending || removeAdminAccess.isPending}
              />
            )}
            {active === "permissions" && (
              <PermissionsSection
                admins={admins}
                selectedAdmin={selectedAdmin}
                selectedAdminId={selectedAdminId}
                setSelectedAdminId={setSelectedAdminId}
                permissions={catalogQuery.data?.permissions ?? []}
                canManage={canManageAdmins}
                onToggle={togglePermission}
                draftPermissions={draftPermissions}
                setDraftPermissions={setDraftPermissions}
              />
            )}
            {["services", "attendance", "giving", "children", "notifications", "integrations", "security", "system"].includes(active) && (
              <SettingsGroupSection
                group={active}
                settings={settings[active] ?? {}}
                canSave={isSuperAdmin || !["giving", "integrations", "security"].includes(active)}
                onSave={(next) => saveGroup.mutate({ group: active, settings: next })}
                isSaving={saveGroup.isPending}
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function ChurchProfileSection({ profile, onSave, isSaving }: { profile: ChurchProfile; onSave: (profile: ChurchProfile) => void; isSaving: boolean }) {
  const [form, setForm] = React.useState<ChurchProfile>(profile);
  React.useEffect(() => setForm(profile), [profile]);
  const set = (key: keyof ChurchProfile, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Church Profile</CardTitle>
        <CardDescription>Branding and church details used across receipts, emails, and future public pages.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Church Name" value={form.churchName} onChange={(value) => set("churchName", value)} />
          <Field label="Church Logo URL" value={form.churchLogoUrl ?? ""} onChange={(value) => set("churchLogoUrl", value)} />
          <Field label="Church Phone Number" value={form.churchPhoneNumber ?? ""} onChange={(value) => set("churchPhoneNumber", value)} />
          <Field label="Church Email" value={form.churchEmail ?? ""} onChange={(value) => set("churchEmail", value)} />
          <Field label="Website URL" value={form.websiteUrl ?? ""} onChange={(value) => set("websiteUrl", value)} />
          <Field label="Church EIN / Tax ID" value={form.churchEin ?? ""} onChange={(value) => set("churchEin", value)} />
          <Field label="Timezone" value={form.timezone} onChange={(value) => set("timezone", value)} />
          <Field label="Default Language" value={form.defaultLanguage} onChange={(value) => set("defaultLanguage", value)} />
          <Field label="YouTube" value={form.youtubeUrl ?? ""} onChange={(value) => set("youtubeUrl", value)} />
          <Field label="Facebook" value={form.facebookUrl ?? ""} onChange={(value) => set("facebookUrl", value)} />
          <Field label="Instagram" value={form.instagramUrl ?? ""} onChange={(value) => set("instagramUrl", value)} />
          <Field label="Default Zoom Link" value={form.defaultZoomLink ?? ""} onChange={(value) => set("defaultZoomLink", value)} />
          <div className="space-y-2 md:col-span-2">
            <Label>Church Address</Label>
            <Textarea value={form.churchAddress ?? ""} onChange={(event) => set("churchAddress", event.target.value)} rows={3} />
          </div>
        </div>
        <Button onClick={() => onSave(form)} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> Save Church Profile</Button>
      </CardContent>
    </Card>
  );
}

function AdminsSection({
  admins,
  invitations,
  activity,
  canManage,
  onInvite,
  onUpdate,
  onRemove,
  isSaving,
}: {
  admins: AdminUser[];
  invitations: AdminInvitation[];
  activity: Array<{ type: string; label: string; detail: string; status: string }>;
  canManage: boolean;
  onInvite: (formData: FormData) => void;
  onUpdate: (id: number, updates: Partial<AdminUser>) => void;
  onRemove: (id: number) => void;
  isSaving: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const filtered = admins.filter((admin) => `${admin.firstName} ${admin.lastName} ${admin.email} ${admin.assignedMinistry ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Admin Management</CardTitle>
            <CardDescription>View admins, edit profiles, disable accounts, and send secure invites.</CardDescription>
          </div>
          {canManage && <InviteAdminDialog onInvite={onInvite} isSaving={isSaving} />}
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search admins" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Ministry</TableHead><TableHead>Status</TableHead><TableHead>Last Login</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {filtered.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell><div className="font-medium">{admin.firstName} {admin.lastName}</div><div className="text-xs text-muted-foreground">{admin.email}</div></TableCell>
                    <TableCell>{admin.adminTitle}</TableCell>
                    <TableCell>{admin.assignedMinistry ?? "Not assigned"}</TableCell>
                    <TableCell><Badge variant={admin.accountStatus === "active" ? "default" : "secondary"}>{admin.accountStatus}</Badge></TableCell>
                    <TableCell>{dateTime(admin.lastLoginAt)}</TableCell>
                    <TableCell className="text-right">
                      {canManage && <EditAdminDialog admin={admin} onUpdate={onUpdate} onRemove={onRemove} isSaving={isSaving} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Admin Invitations</CardTitle><CardDescription>Invite links expire and cannot be reused after acceptance.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
            <TableBody>
              {invitations.map((invite) => (
                <TableRow key={invite.id}><TableCell>{invite.name}</TableCell><TableCell>{invite.email}</TableCell><TableCell>{invite.adminTitle}</TableCell><TableCell><Badge variant={invite.status === "pending" ? "secondary" : "outline"}>{invite.status}</Badge></TableCell><TableCell>{dateTime(invite.sentAt)}</TableCell><TableCell>{dateTime(invite.expiresAt)}</TableCell></TableRow>
              ))}
              {!invitations.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No invitations to show.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Admin Activity</CardTitle><CardDescription>v0 activity summary from login and invite records.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {activity.map((item, index) => <div key={`${item.type}-${index}`} className="rounded-md border p-3"><div className="flex items-center justify-between"><p className="font-medium">{item.label}</p><Badge variant="outline">{item.status}</Badge></div><p className="text-sm text-muted-foreground">{item.detail}</p></div>)}
          {!activity.length && <p className="text-sm text-muted-foreground">No activity available.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionsSection({
  admins,
  selectedAdmin,
  selectedAdminId,
  setSelectedAdminId,
  permissions,
  canManage,
  onToggle,
  draftPermissions,
  setDraftPermissions,
}: {
  admins: AdminUser[];
  selectedAdmin?: AdminUser;
  selectedAdminId: number | null;
  setSelectedAdminId: (id: number) => void;
  permissions: PermissionCatalogItem[];
  canManage: boolean;
  onToggle: (admin: AdminUser, permission: string, checked: boolean) => void;
  draftPermissions: string[];
  setDraftPermissions: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader><CardTitle>Admins</CardTitle><CardDescription>Select an admin to review database-backed permissions.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {admins.map((admin) => <button key={admin.id} className={`w-full rounded-md border p-3 text-left ${selectedAdminId === admin.id || (!selectedAdminId && selectedAdmin?.id === admin.id) ? "border-primary bg-primary/5" : "hover:bg-muted"}`} onClick={() => setSelectedAdminId(admin.id)}><p className="font-medium">{admin.firstName} {admin.lastName}</p><p className="text-xs text-muted-foreground">{admin.adminTitle}</p></button>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Permissions & Roles</CardTitle><CardDescription>{canManage ? "Super Admin permission editing is enabled." : "Read-only. Only Super Admins can edit permissions."}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission.key} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox checked={selectedAdmin?.permissions.includes(permission.key) ?? false} disabled={!canManage || !selectedAdmin} onCheckedChange={(checked) => selectedAdmin && onToggle(selectedAdmin, permission.key, checked === true)} />
                <span><span className="block text-sm font-medium">{permission.label}</span><span className="block text-xs text-muted-foreground">{permission.description}</span></span>
              </label>
            ))}
          </div>
          <Separator />
          <div>
            <p className="mb-3 text-sm font-medium">Initial Invite Permission Draft</p>
            <div className="grid gap-3 md:grid-cols-3">
              {permissions.map((permission) => <label key={permission.key} className="flex items-center gap-2 rounded-md border p-3 text-sm"><Checkbox checked={draftPermissions.includes(permission.key)} onCheckedChange={(checked) => setDraftPermissions((current) => checked ? Array.from(new Set([...current, permission.key])) : current.filter((item) => item !== permission.key))} />{permission.label}</label>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsGroupSection({ group, settings, canSave, onSave, isSaving }: { group: string; settings: SettingsPayload; canSave: boolean; onSave: (settings: SettingsPayload) => void; isSaving: boolean }) {
  const [form, setForm] = React.useState<SettingsPayload>(settings);
  React.useEffect(() => setForm(settings), [settings]);
  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const fields = Object.entries(form);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{GROUP_LABELS[group]}</CardTitle>
        <CardDescription>{group === "giving" ? "Stripe secret keys are configured in Replit Secrets and only configuration status is shown here." : "Configure defaults for this Church OS module."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(([key, value]) => (
            <SettingControl key={key} name={key} value={value} onChange={(next) => set(key, next)} />
          ))}
        </div>
        {!canSave && <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Only Super Admins can edit this sensitive settings group.</div>}
        <Button onClick={() => onSave(form)} disabled={!canSave || isSaving}><Save className="mr-2 h-4 w-4" /> Save {GROUP_LABELS[group]}</Button>
      </CardContent>
    </Card>
  );
}

function SettingControl({ name, value, onChange }: { name: string; value: unknown; onChange: (value: unknown) => void }) {
  const label = labelize(name);
  const isConfigStatus = name.endsWith("Configured");
  if (typeof value === "boolean") {
    return (
      <label className="flex items-center justify-between rounded-md border p-3">
        <span>
          <span className="block text-sm font-medium">{label}</span>
          {isConfigStatus && <span className="block text-xs text-muted-foreground">Read from Replit environment variables.</span>}
        </span>
        <Checkbox checked={bool(value)} disabled={isConfigStatus} onCheckedChange={(checked) => onChange(checked === true)} />
      </label>
    );
  }
  if (typeof value === "number") {
    return <Field label={label} value={numberText(value)} type="number" onChange={(next) => onChange(Number(next))} />;
  }
  if (Array.isArray(value)) {
    return <Field label={label} value={arrayText(value)} onChange={(next) => onChange(next.split(",").map((item) => item.trim()).filter(Boolean))} />;
  }
  if (typeof value === "object" && value) {
    return <div className="space-y-2 md:col-span-2"><Label>{label}</Label><Textarea value={JSON.stringify(value, null, 2)} onChange={(event) => { try { onChange(JSON.parse(event.target.value)); } catch { /* keep typing */ } }} rows={5} /></div>;
  }
  return <Field label={label} value={text(value)} onChange={onChange} />;
}

function InviteAdminDialog({ onInvite, isSaving }: { onInvite: (formData: FormData) => void; isSaving: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button>Invite Admin</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Invite Admin</DialogTitle><DialogDescription>Secure invite links expire and admin role assignment stays backend-controlled.</DialogDescription></DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onInvite(new FormData(event.currentTarget)); event.currentTarget.reset(); }}>
          <FieldInput name="firstName" label="First Name" />
          <FieldInput name="lastName" label="Last Name" />
          <FieldInput name="email" label="Email Address" type="email" />
          <div className="space-y-2"><Label>Admin Title</Label><select name="adminLevel" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="minister">Minister</option><option value="pastor">Pastor</option><option value="super_admin">Super Admin</option></select></div>
          <FieldInput name="assignedMinistry" label="Assigned Ministry / Department" required={false} />
          <Button className="md:col-span-2" disabled={isSaving}>Send Invite</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAdminDialog({ admin, onUpdate, onRemove, isSaving }: { admin: AdminUser; onUpdate: (id: number, updates: Partial<AdminUser>) => void; onRemove: (id: number) => void; isSaving: boolean }) {
  const [form, setForm] = React.useState(admin);
  React.useEffect(() => setForm(admin), [admin]);
  const set = (key: keyof AdminUser, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline">Manage</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit Admin</DialogTitle><DialogDescription>Update admin profile fields or disable/remove access.</DialogDescription></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First Name" value={form.firstName} onChange={(value) => set("firstName", value)} />
          <Field label="Last Name" value={form.lastName} onChange={(value) => set("lastName", value)} />
          <Field label="Phone Number" value={form.phoneNumber ?? ""} onChange={(value) => set("phoneNumber", value)} />
          <Field label="Profile Picture URL" value={form.profilePhotoUrl ?? ""} onChange={(value) => set("profilePhotoUrl", value)} />
          <div className="space-y-2"><Label>Admin Title</Label><select value={form.adminLevel} onChange={(event) => set("adminLevel", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="minister">Minister</option><option value="pastor">Pastor</option><option value="super_admin">Super Admin</option></select></div>
          <div className="space-y-2"><Label>Account Status</Label><select value={form.accountStatus} onChange={(event) => set("accountStatus", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="active">Active</option><option value="pending">Pending</option><option value="disabled">Disabled</option></select></div>
          <Field label="Assigned Ministry / Department" value={form.assignedMinistry ?? ""} onChange={(value) => set("assignedMinistry", value)} />
        </div>
        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="destructive" onClick={() => onRemove(admin.id)} disabled={isSaving}>Remove Admin Access</Button>
          <Button onClick={() => onUpdate(admin.id, form)} disabled={isSaving}>Save Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function FieldInput({ name, label, type = "text", required = true }: { name: string; label: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} /></div>;
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

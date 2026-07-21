import React from "react";
import { apiJson } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_LEVELS, PERMISSIONS, type AdminLevel } from "@/lib/permissions";
import {
  CalendarDays,
  Church,
  CreditCard,
  Lock,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";

type PermissionCatalogItem = { key: string; label: string; description: string };
type PermissionPreset = { key: string; label: string; description: string; permissions: string[] };
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
type PermissionChangeRequest = {
  admin: AdminUser;
  permissions: string[];
  title: string;
  description: string;
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
  { id: "security", label: "Security", icon: Lock },
] as const;

const GROUP_LABELS: Record<string, string> = {
  services: "Services & Events Settings",
  attendance: "Attendance Settings",
  giving: "Giving & Stripe Settings",
  children: "Children Ministry Settings",
  security: "Security",
};

const PERMISSION_GROUPS = [
  {
    id: "operations",
    label: "Operations",
    keys: [
      "attendance_checkin",
      "attendance_management",
      "member_directory",
      "member_profiles",
      "event_management",
    ],
  },
  {
    id: "giving",
    label: "Giving",
    keys: [
      "giving_management",
      "campaign_management",
    ],
  },
  {
    id: "system",
    label: "System",
    keys: ["admin_management", "system_settings"],
  },
] as const;


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
  const [pendingPermissionChange, setPendingPermissionChange] = React.useState<PermissionChangeRequest | null>(null);

  const isSuperAdmin = user?.adminLevel === ADMIN_LEVELS.SUPER_ADMIN;
  const canManageAdmins = isSuperAdmin && user?.adminPermissions?.includes(PERMISSIONS.ADMIN_MANAGEMENT);

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiJson<{ churchProfile: ChurchProfile; settings: Record<string, SettingsPayload> }>("/admin/settings"),
  });
  const catalogQuery = useQuery({
    queryKey: ["admin-permission-catalog"],
    queryFn: () => apiJson<{ permissions: PermissionCatalogItem[]; defaults: Record<AdminLevel, string[]>; presets: PermissionPreset[] }>("/admin/permission-catalog"),
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
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
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
      void queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      void queryClient.invalidateQueries({ queryKey: ["getMe"] });
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

  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

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
      setInviteDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
    onError: (error) => toast({ title: "Invite failed", description: error.message, variant: "destructive" }),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: number) => apiJson(`/admin/invitations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Invitation revoked" });
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
    onError: (error) => toast({ title: "Could not revoke invitation", description: error.message, variant: "destructive" }),
  });

  const admins = adminsQuery.data?.admins ?? [];
  const selectedAdmin = admins.find((admin) => admin.id === selectedAdminId) ?? admins[0];
  const settings = settingsQuery.data?.settings ?? {};

  function requestPermissionChange(request: PermissionChangeRequest) {
    setPendingPermissionChange(request);
  }

  function confirmPermissionChange() {
    if (!pendingPermissionChange) return;
    updatePermissions.mutate({
      adminId: pendingPermissionChange.admin.id,
      permissions: pendingPermissionChange.permissions,
    });
    setPendingPermissionChange(null);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Settings"
          description="Manage admins, permissions, and church-wide configuration."
          icon={<SettingsIcon className="h-6 w-6" />}
          actions={<Badge variant={isSuperAdmin ? "default" : "outline"}>{isSuperAdmin ? "Super Admin" : "Permission Controlled"}</Badge>}
        />

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
                inviteDialogOpen={inviteDialogOpen}
                onInviteDialogOpenChange={setInviteDialogOpen}
                onInvite={(formData) => inviteAdmin.mutate(formData)}
                onUpdate={(id, updates) => updateAdmin.mutate({ id, updates })}
                onRemove={(id) => removeAdminAccess.mutate(id)}
                onRevoke={(id) => revokeInvite.mutate(id)}
                isSaving={inviteAdmin.isPending || updateAdmin.isPending || removeAdminAccess.isPending}
                isRevoking={revokeInvite.isPending}
              />
            )}
            {active === "permissions" && (
              <PermissionsSection
                admins={admins}
                selectedAdmin={selectedAdmin}
                selectedAdminId={selectedAdminId}
                setSelectedAdminId={setSelectedAdminId}
                permissions={catalogQuery.data?.permissions ?? []}
                presets={catalogQuery.data?.presets ?? []}
                canManage={canManageAdmins}
                onRequestSave={(admin, permissions) => requestPermissionChange({
                  admin,
                  permissions,
                  title: "Confirm permission changes?",
                  description: `Save ${permissions.length} enabled permissions for ${admin.firstName} ${admin.lastName}. This takes effect the next time that admin loads the app or logs in.`,
                })}
                draftPermissions={draftPermissions}
                setDraftPermissions={setDraftPermissions}
              />
            )}
            {["services", "attendance", "giving", "children", "security"].includes(active) && (
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
      <AlertDialog open={Boolean(pendingPermissionChange)} onOpenChange={(open) => !open && setPendingPermissionChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingPermissionChange?.title ?? "Confirm permission change"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPermissionChange?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingPermissionChange && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{pendingPermissionChange.admin.firstName} {pendingPermissionChange.admin.lastName}</p>
              <p className="text-xs text-muted-foreground">{pendingPermissionChange.admin.email}</p>
              <p className="mt-2 text-xs text-muted-foreground">{pendingPermissionChange.permissions.length} permissions will be enabled.</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatePermissions.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermissionChange} disabled={updatePermissions.isPending}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <CardDescription>Branding and church details used across receipts, emails, and ministry communication.</CardDescription>
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
  inviteDialogOpen,
  onInviteDialogOpenChange,
  onInvite,
  onUpdate,
  onRemove,
  onRevoke,
  isSaving,
  isRevoking,
}: {
  admins: AdminUser[];
  invitations: AdminInvitation[];
  activity: Array<{ type: string; label: string; detail: string; status: string }>;
  canManage: boolean;
  inviteDialogOpen: boolean;
  onInviteDialogOpenChange: (open: boolean) => void;
  onInvite: (formData: FormData) => void;
  onUpdate: (id: number, updates: Partial<AdminUser>) => void;
  onRemove: (id: number) => void;
  onRevoke: (id: number) => void;
  isSaving: boolean;
  isRevoking: boolean;
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
          {canManage && <InviteAdminDialog open={inviteDialogOpen} onOpenChange={onInviteDialogOpenChange} onInvite={onInvite} isSaving={isSaving} />}
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
        <CardHeader><CardTitle>Admin Invitations</CardTitle><CardDescription>Invite links expire in 72 hours and cannot be reused after acceptance.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead>Expires</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
            <TableBody>
              {invitations.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.name}</TableCell>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>{invite.adminTitle}</TableCell>
                  <TableCell><Badge variant={invite.status === "pending" ? "secondary" : "outline"}>{invite.status}</Badge></TableCell>
                  <TableCell>{dateTime(invite.sentAt)}</TableCell>
                  <TableCell>{dateTime(invite.expiresAt)}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {invite.status === "pending" && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={isRevoking} onClick={() => onRevoke(invite.id)}>
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!invitations.length && <TableRow><TableCell colSpan={canManage ? 7 : 6} className="py-8 text-center text-muted-foreground">No invitations to show.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Admin Activity</CardTitle><CardDescription>Recent account and invitation activity.</CardDescription></CardHeader>
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
  presets,
  canManage,
  onRequestSave,
  draftPermissions,
  setDraftPermissions,
}: {
  admins: AdminUser[];
  selectedAdmin?: AdminUser;
  selectedAdminId: number | null;
  setSelectedAdminId: (id: number) => void;
  permissions: PermissionCatalogItem[];
  presets: PermissionPreset[];
  canManage: boolean;
  onRequestSave: (admin: AdminUser, permissions: string[]) => void;
  draftPermissions: string[];
  setDraftPermissions: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [stagedPermissions, setStagedPermissions] = React.useState<string[]>(selectedAdmin?.permissions ?? []);
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));
  const savedPermissions = selectedAdmin?.permissions ?? [];
  const stagedPermissionLabels = stagedPermissions
    .map((key) => permissionByKey.get(key)?.label ?? key)
    .sort((a, b) => a.localeCompare(b)) ?? [];
  const savedKey = [...savedPermissions].sort().join("|");
  const stagedKey = [...stagedPermissions].sort().join("|");
  const hasChanges = savedKey !== stagedKey;
  const groupedPermissionKeys = new Set<string>(PERMISSION_GROUPS.flatMap((group) => [...group.keys]));
  const ungroupedPermissions = permissions.filter((permission) => !groupedPermissionKeys.has(permission.key));
  const groupedPermissions = [
    ...PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: group.keys
        .map((key) => permissionByKey.get(key))
        .filter((permission): permission is PermissionCatalogItem => Boolean(permission)),
    })).filter((group) => group.permissions.length > 0),
    ...(ungroupedPermissions.length > 0 ? [{ id: "other", label: "Other", keys: [], permissions: ungroupedPermissions }] : []),
  ];

  React.useEffect(() => {
    setStagedPermissions(selectedAdmin?.permissions ?? []);
  }, [selectedAdmin?.id, savedKey]);

  function setPermission(permission: string, checked: boolean) {
    setStagedPermissions((current) => checked
      ? Array.from(new Set([...current, permission]))
      : current.filter((item) => item !== permission));
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Permissions & Roles</CardTitle>
        <CardDescription>{canManage ? "Select an admin, apply a preset, or tune individual access." : "Read-only. Only Super Admins can edit permissions."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,360px)_1fr]">
          <div className="space-y-2">
            <Label>Admin Account</Label>
            <Select
              value={String(selectedAdmin?.id ?? selectedAdminId ?? "")}
              onValueChange={(value) => setSelectedAdminId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={String(admin.id)}>
                    {admin.firstName} {admin.lastName} - {admin.adminTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{selectedAdmin ? `${selectedAdmin.firstName} ${selectedAdmin.lastName}` : "No admin selected"}</p>
                <p className="text-xs text-muted-foreground">{selectedAdmin?.email ?? "Select an account to manage permissions."}</p>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && <Badge variant="secondary">Unsaved</Badge>}
                <Badge variant="outline">{stagedPermissionLabels.length} enabled</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stagedPermissionLabels.slice(0, 6).map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
              ))}
              {stagedPermissionLabels.length > 6 && <Badge variant="outline" className="text-xs">+{stagedPermissionLabels.length - 6} more</Badge>}
              {selectedAdmin && stagedPermissionLabels.length === 0 && <span className="text-xs text-muted-foreground">No permissions enabled.</span>}
            </div>
          </div>
        </div>

        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3">
            <span className="mr-1 text-sm font-medium">Presets</span>
            {presets.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                size="sm"
                disabled={!canManage || !selectedAdmin}
                onClick={() => setStagedPermissions(preset.permissions)}
                title={preset.description}
              >
                Stage {preset.label}
              </Button>
            ))}
          </div>
        )}

        <Accordion type="multiple" defaultValue={["operations"]} className="rounded-md border">
          {groupedPermissions.map((group) => {
            const enabledCount = group.permissions.filter((permission) => stagedPermissions.includes(permission.key)).length;
            return (
              <AccordionItem key={group.id} value={group.id} className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="flex w-full items-center justify-between pr-3">
                    <span className="text-sm font-medium">{group.label}</span>
                    <Badge variant="outline" className="ml-3">{enabledCount}/{group.permissions.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label key={permission.key} className="flex items-start gap-3 rounded-md border bg-background p-3">
                        <Checkbox checked={stagedPermissions.includes(permission.key)} disabled={!canManage || !selectedAdmin} onCheckedChange={(checked) => setPermission(permission.key, checked === true)} />
                        <span><span className="block text-sm font-medium">{permission.label}</span><span className="block text-xs text-muted-foreground">{permission.description}</span></span>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {canManage && selectedAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
            <p className="text-sm text-muted-foreground">
              {hasChanges ? "Review staged permission changes before saving." : "Select permissions above, then confirm changes when ready."}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={!hasChanges} onClick={() => setStagedPermissions(savedPermissions)}>
                Discard Changes
              </Button>
              <Button type="button" disabled={!hasChanges} onClick={() => onRequestSave(selectedAdmin, stagedPermissions)}>
                Confirm Changes
              </Button>
            </div>
          </div>
        )}

        <Accordion type="single" collapsible className="rounded-md border">
          <AccordionItem value="invite-draft" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="flex w-full items-center justify-between pr-3">
                <span className="text-sm font-medium">Initial Invite Permissions</span>
                <Badge variant="outline">{draftPermissions.length} selected</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {presets.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraftPermissions(preset.permissions)}
                      title={preset.description}
                    >
                      Use {preset.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-3">
                {permissions.map((permission) => (
                  <label key={permission.key} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <Checkbox checked={draftPermissions.includes(permission.key)} onCheckedChange={(checked) => setDraftPermissions((current) => checked ? Array.from(new Set([...current, permission.key])) : current.filter((item) => item !== permission.key))} />
                    {permission.label}
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function SettingsGroupSection({ group, settings, canSave, onSave, isSaving }: { group: string; settings: SettingsPayload; canSave: boolean; onSave: (settings: SettingsPayload) => void; isSaving: boolean }) {
  const [form, setForm] = React.useState<SettingsPayload>(settings);
  React.useEffect(() => setForm(settings), [settings]);
  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const fields = Object.entries(form).filter(([key]) => !(group === "giving" && key === "monthlyGivingGoals"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{GROUP_LABELS[group]}</CardTitle>
        <CardDescription>{group === "giving" ? "Payment credentials are managed securely outside this screen. Only connection status is shown here." : "Configure defaults for this Church OS module."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {group === "giving" && (
          <MonthlyGivingGoalsEditor
            value={form.monthlyGivingGoals}
            onChange={(next) => set("monthlyGivingGoals", next)}
          />
        )}
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

function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function centsFromDollars(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function MonthlyGivingGoalsEditor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const records = React.useMemo(() => {
    const raw = Array.isArray(value) ? value : [];
    return raw
      .map((item) => {
        const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
        return {
          month: typeof record.month === "string" ? record.month : currentMonthValue(),
          goalCents: typeof record.goalCents === "number" ? record.goalCents : 0,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [value]);

  const updateAt = (index: number, next: { month: string; goalCents: number }) => {
    onChange(records.map((record, i) => (i === index ? next : record)));
  };
  const removeAt = (index: number) => onChange(records.filter((_, i) => i !== index));
  const addMonth = () => {
    const month = currentMonthValue();
    onChange([{ month, goalCents: 25000000 }, ...records]);
  };

  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Monthly Giving Goals</p>
          <p className="text-xs text-muted-foreground">Set one goal per month. Previous months remain in the record.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addMonth}>Add Month</Button>
      </div>
      <div className="mt-4 space-y-3">
        {records.map((record, index) => (
          <div key={`${record.month}-${index}`} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input
                type="month"
                value={record.month}
                onChange={(event) => updateAt(index, { ...record, month: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Goal Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={dollarsFromCents(record.goalCents)}
                onChange={(event) => updateAt(index, { ...record, goalCents: centsFromDollars(event.target.value) })}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => removeAt(index)}>Remove</Button>
          </div>
        ))}
        {records.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No monthly goals yet.</p>}
      </div>
    </div>
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
          {isConfigStatus && <span className="block text-xs text-muted-foreground">Managed through secure environment settings.</span>}
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

function InviteAdminDialog({ open, onOpenChange, onInvite, isSaving }: { open: boolean; onOpenChange: (open: boolean) => void; onInvite: (formData: FormData) => void; isSaving: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button onClick={() => onOpenChange(true)}>Invite Admin</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Invite Admin</DialogTitle><DialogDescription>A secure invite link will be emailed. Admin role assignment stays backend-controlled.</DialogDescription></DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onInvite(new FormData(event.currentTarget)); event.currentTarget.reset(); }}>
          <FieldInput name="firstName" label="First Name" />
          <FieldInput name="lastName" label="Last Name" />
          <FieldInput name="email" label="Email Address" type="email" />
          <div className="space-y-2"><Label>Admin Title</Label><select name="adminLevel" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="minister">Minister</option><option value="pastor">Pastor</option><option value="super_admin">Super Admin</option></select></div>
          <FieldInput name="assignedMinistry" label="Assigned Ministry / Department" required={false} />
          <Button className="md:col-span-2" disabled={isSaving}>{isSaving ? "Sending…" : "Send Invite"}</Button>
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

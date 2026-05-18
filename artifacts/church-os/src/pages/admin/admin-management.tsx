import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_LEVELS, PERMISSIONS, type AdminLevel } from "@/lib/permissions";

type PermissionCatalogItem = {
  key: string;
  label: string;
  description: string;
};

type AdminUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  adminLevel: AdminLevel;
  adminTitle: string;
  assignedMinistry: string | null;
  accountStatus: string;
  permissions: string[];
};

type AdminInvitation = {
  id: number;
  name: string;
  email: string;
  adminTitle: string;
  status: string;
  sentAt: string;
  expiresAt: string;
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

export default function AdminManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const canManage = user?.adminLevel === ADMIN_LEVELS.SUPER_ADMIN && user.adminPermissions?.includes(PERMISSIONS.ADMIN_MANAGEMENT);

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
    enabled: canManage,
  });

  const admins = adminsQuery.data?.admins ?? [];
  const selectedAdmin = useMemo(() => {
    return admins.find((admin) => admin.id === selectedAdminId) ?? admins.find((admin) => admin.id !== user?.id) ?? admins[0];
  }, [admins, selectedAdminId, user?.id]);

  const updatePermissions = useMutation({
    mutationFn: (payload: { adminId: number; permissions: string[] }) =>
      apiJson<{ permissions: string[] }>(`/admin/users/${payload.adminId}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: payload.permissions }),
      }),
    onSuccess: () => {
      toast({ title: "Permissions updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast({ title: "Permission update failed", description: error.message, variant: "destructive" }),
  });

  const inviteAdmin = useMutation({
    mutationFn: (formData: FormData) => {
      const adminLevel = String(formData.get("adminLevel")) as AdminLevel;
      const permissions = draftPermissions.length > 0
        ? draftPermissions
        : catalogQuery.data?.defaults[adminLevel] ?? [];

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

  function togglePermission(permission: string, checked: boolean, mode: "selected" | "invite") {
    if (mode === "selected") {
      const current = selectedAdmin?.permissions ?? [];
      const next = checked ? Array.from(new Set([...current, permission])) : current.filter((item) => item !== permission);
      updatePermissions.mutate({ adminId: selectedAdmin!.id, permissions: next });
      return;
    }

    setDraftPermissions((current) => (
      checked ? Array.from(new Set([...current, permission])) : current.filter((item) => item !== permission)
    ));
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Management</h1>
            <p className="text-muted-foreground">Invite admins and manage database-backed feature permissions.</p>
          </div>
          <Badge variant={canManage ? "default" : "outline"}>
            {canManage ? "Super Admin controls enabled" : "Read-only"}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Admins</CardTitle>
              <CardDescription>Select an admin to review permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {admins.map((admin) => (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => setSelectedAdminId(admin.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedAdmin?.id === admin.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{admin.firstName} {admin.lastName}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                    </div>
                    <Badge variant="secondary">{admin.adminTitle}</Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                {selectedAdmin ? `${selectedAdmin.firstName} ${selectedAdmin.lastName}` : "Select an admin"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManage && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Only Super Admins can edit admin permissions.
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {(catalogQuery.data?.permissions ?? []).map((permission) => (
                  <label key={permission.key} className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={selectedAdmin?.permissions.includes(permission.key) ?? false}
                      disabled={!canManage || !selectedAdmin || updatePermissions.isPending}
                      onCheckedChange={(checked) => togglePermission(permission.key, Boolean(checked), "selected")}
                    />
                    <span>
                      <span className="block text-sm font-medium">{permission.label}</span>
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Invite Admin</CardTitle>
              <CardDescription>Send a secure, expiring invite with an assigned title and initial permissions.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  inviteAdmin.mutate(new FormData(event.currentTarget));
                  event.currentTarget.reset();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field name="firstName" label="First Name" />
                  <Field name="lastName" label="Last Name" />
                  <Field name="email" label="Email Address" type="email" />
                  <div className="space-y-2">
                    <Label htmlFor="adminLevel">Admin Title</Label>
                    <select id="adminLevel" name="adminLevel" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="minister">Minister</option>
                      <option value="pastor">Pastor</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <Field name="assignedMinistry" label="Assigned Ministry / Department" required={false} />
                </div>

                <Separator />
                <div>
                  <p className="mb-3 text-sm font-medium">Initial Permissions</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(catalogQuery.data?.permissions ?? []).map((permission) => (
                      <label key={permission.key} className="flex items-start gap-3 rounded-md border p-3">
                        <Checkbox
                          checked={draftPermissions.includes(permission.key)}
                          onCheckedChange={(checked) => togglePermission(permission.key, Boolean(checked), "invite")}
                        />
                        <span className="text-sm">{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={inviteAdmin.isPending}>
                  Send Invite
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Invitations</CardTitle>
              <CardDescription>Pending, accepted, and expired admin invites.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invitationsQuery.data?.invitations ?? []).map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.name}</TableCell>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>{invite.adminTitle}</TableCell>
                      <TableCell><Badge variant="outline">{invite.status}</Badge></TableCell>
                      <TableCell>{new Date(invite.sentAt).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invite.expiresAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function Field({ name, label, type = "text", required = true }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

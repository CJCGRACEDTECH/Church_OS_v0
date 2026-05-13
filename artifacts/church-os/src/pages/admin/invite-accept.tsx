import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type InviteDetails = {
  firstName: string;
  lastName: string;
  email: string;
  adminTitle: string;
  assignedMinistry: string | null;
  expiresAt: string;
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export default function AdminInviteAccept() {
  const [, params] = useRoute("/admin/invite/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params?.token ?? "";
  const [password, setPassword] = useState("");

  const inviteQuery = useQuery({
    queryKey: ["admin-invite", token],
    queryFn: () => apiJson<InviteDetails>(`/admin/invitations/accept/${token}`),
    enabled: Boolean(token),
  });

  const acceptInvite = useMutation({
    mutationFn: () => apiJson<{ redirectTo: string }>(`/admin/invitations/accept/${token}`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
    onSuccess: (data) => {
      toast({ title: "Admin account ready" });
      setLocation(data.redirectTo);
    },
    onError: (error) => toast({ title: "Invite could not be accepted", description: error.message, variant: "destructive" }),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Badge className="mb-2 w-fit">Admin Invitation</Badge>
          <CardTitle>Complete your admin setup</CardTitle>
          <CardDescription>
            This secure invite can only be used once and expires automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {inviteQuery.isLoading && <p className="text-sm text-muted-foreground">Loading invite...</p>}
          {inviteQuery.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {inviteQuery.error.message}
            </div>
          )}
          {inviteQuery.data && (
            <>
              <div className="grid gap-3 rounded-md border bg-background p-4 text-sm">
                <Info label="Name" value={`${inviteQuery.data.firstName} ${inviteQuery.data.lastName}`} />
                <Info label="Email" value={inviteQuery.data.email} />
                <Info label="Admin Title" value={inviteQuery.data.adminTitle} />
                <Info label="Ministry / Department" value={inviteQuery.data.assignedMinistry ?? "Not assigned"} />
                <Info label="Expires" value={new Date(inviteQuery.data.expiresAt).toLocaleString()} />
              </div>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  acceptInvite.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="password">Create Password</Label>
                  <Input
                    id="password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={acceptInvite.isPending}>
                  Accept Invite
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

import { useLocation, useRoute, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
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

  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();

  const inviteQuery = useQuery({
    queryKey: ["admin-invite", token],
    queryFn: () => apiJson<InviteDetails>(`/admin/invitations/accept/${token}`),
    enabled: Boolean(token),
  });

  const acceptInvite = useMutation({
    mutationFn: () =>
      apiJson<{ redirectTo: string }>(`/admin/invitations/accept/${token}`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      toast({ title: "Admin account activated" });
      setLocation(data.redirectTo);
    },
    onError: (error) =>
      toast({ title: "Invite could not be accepted", description: error.message, variant: "destructive" }),
  });

  const invitedEmail = inviteQuery.data?.email;
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  const emailMismatch =
    clerkLoaded && isSignedIn && invitedEmail && clerkEmail &&
    clerkEmail.toLowerCase() !== invitedEmail.toLowerCase();
  const emailMatch =
    clerkLoaded && isSignedIn && invitedEmail && clerkEmail &&
    clerkEmail.toLowerCase() === invitedEmail.toLowerCase();

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
          {inviteQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading invite...</p>
          )}
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

              {!clerkLoaded && (
                <p className="text-sm text-muted-foreground">Checking sign-in status...</p>
              )}

              {clerkLoaded && !isSignedIn && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-blue-900">Sign in first to accept this invite</p>
                  <p className="text-sm text-blue-700">
                    You must be signed into Church OS with{" "}
                    <span className="font-semibold">{inviteQuery.data.email}</span> before you can accept this invitation.
                  </p>
                  <Link href={`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`}>
                    <Button className="w-full">Sign in or create an account</Button>
                  </Link>
                </div>
              )}

              {emailMismatch && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                  <p className="text-sm font-medium text-destructive">Wrong account signed in</p>
                  <p className="text-sm text-destructive/80">
                    You're signed in as <span className="font-semibold">{clerkEmail}</span>, but this invite is for{" "}
                    <span className="font-semibold">{invitedEmail}</span>. Please sign out and sign in with the invited email address.
                  </p>
                </div>
              )}

              {emailMatch && (
                <Button
                  className="w-full"
                  onClick={() => acceptInvite.mutate()}
                  disabled={acceptInvite.isPending}
                >
                  {acceptInvite.isPending ? "Accepting..." : "Accept Invite"}
                </Button>
              )}
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

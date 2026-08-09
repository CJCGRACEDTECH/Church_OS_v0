import { useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type InviteDetails = {
  // The server intentionally omits name, role, and ministry from this
  // unauthenticated response to prevent PII disclosure to anyone who
  // obtains the token out-of-band.  Only the redacted email and expiry
  // are returned so the recipient can confirm the invite is for them.
  email: string; // partially redacted by the server for display only
  expiresAt: string;
};

class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

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
  if (!response.ok) throw new ApiError(data.error ?? "Request failed", response.status, data.code);
  return data as T;
}

export default function AdminInviteAccept() {
  const [, params] = useRoute("/admin/invite/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = params?.token ?? "";

  const { isLoaded: clerkLoaded, isSignedIn } = useUser();

  // Clear any pending invite token from sessionStorage as soon as we land on
  // this page — whether via a direct Clerk redirect or the /app fallback
  // recovery path. Without this, a later visit to / or /app would incorrectly
  // redirect an already-accepted admin back to a stale (or expired) invite URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sessionStorage.removeItem("pendingInviteToken"); }, []);

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
      // The local account was just created by the accept endpoint. Clear the
      // stale 403 from /auth/me so auth-context fetches a fresh result on the
      // next render and does not sign the user out as they navigate to /admin.
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      setLocation(data.redirectTo);
    },
    onError: (error) =>
      toast({ title: "Invite could not be accepted", description: error.message, variant: "destructive" }),
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
          {inviteQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading invite...</p>
          )}
          {inviteQuery.error && (() => {
            const isExpired =
              inviteQuery.error instanceof ApiError &&
              inviteQuery.error.code === "INVITE_EXPIRED";
            return isExpired ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900">This invite has expired</p>
                <p className="text-sm text-amber-800">
                  The link is no longer valid. Ask your admin to send a new invitation to your email address.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {inviteQuery.error.message}
              </div>
            );
          })()}
          {inviteQuery.data && (
            <>
              <div className="grid gap-3 rounded-md border bg-background p-4 text-sm">
                <Info label="Invited email" value={inviteQuery.data.email} />
                <Info label="Expires" value={new Date(inviteQuery.data.expiresAt).toLocaleString()} />
              </div>

              {!clerkLoaded && (
                <p className="text-sm text-muted-foreground">Checking sign-in status...</p>
              )}

              {clerkLoaded && !isSignedIn && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-blue-900">Sign in first to accept this invite</p>
                  <p className="text-sm text-blue-700">
                    Sign into Church OS with the email address that received this invitation before accepting.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      // Persist the invite token so HomeRoute can recover it if
                      // Clerk's allowed-redirect-URL list silently falls back to
                      // /app instead of returning to /admin/invite/:token.
                      sessionStorage.setItem("pendingInviteToken", token);
                      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
                    }}
                  >
                    Sign in or create an account
                  </Button>
                </div>
              )}

              {/* The server verifies that the signed-in Clerk account's primary
                  email matches the invite. The Accept button is shown to any
                  signed-in user; a mismatch produces a clear error message. */}
              {clerkLoaded && isSignedIn && (
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

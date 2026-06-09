import React from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson, formatDateTime, type AttendanceSession } from "@/lib/attendance";
import { CheckCircle2, QrCode } from "lucide-react";

export default function AttendanceCheckIn() {
  const [, params] = useRoute("/attendance/check-in/:token");
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const token = params?.token ?? "";

  React.useEffect(() => {
    if (!isLoading && !user) setLocation("/sign-in");
  }, [isLoading, user, setLocation]);

  const sessionQuery = useQuery({
    queryKey: ["qr-attendance-session", token],
    queryFn: () => apiJson<{ session: AttendanceSession; expired: boolean }>(`/attendance/qr/${token}`),
    enabled: Boolean(token) && Boolean(user),
  });
  const checkIn = useMutation({
    mutationFn: () => apiJson(`/attendance/qr/${token}/check-in`, { method: "POST", body: JSON.stringify({}) }),
  });

  const session = sessionQuery.data?.session;
  const expired = sessionQuery.data?.expired;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-muted/30 p-4 gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.svg" alt="CJC Church" className="h-12 w-auto" />
        <p className="text-sm text-muted-foreground">Church OS · Attendance Check-In</p>
      </div>

      <Card className="w-full max-w-md shadow-md">
        {checkIn.isSuccess ? (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <CardTitle className="text-2xl text-emerald-700">You're checked in!</CardTitle>
              <CardDescription className="text-base">
                {session?.sessionName ?? "Attendance session"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3 pb-8">
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Your attendance has been recorded. See you at the next one!
              </p>
              {session && (
                <p className="text-xs text-muted-foreground">{formatDateTime(session.sessionDate)}</p>
              )}
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                {sessionQuery.isLoading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <QrCode className="h-7 w-7" />
                )}
              </div>
              <CardTitle className="text-xl">
                {session ? session.sessionName : "Attendance Check-In"}
              </CardTitle>
              <CardDescription>
                {session
                  ? formatDateTime(session.sessionDate)
                  : sessionQuery.isLoading
                  ? "Loading session…"
                  : "CJC Church"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center pb-8">
              {expired && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  This QR check-in has expired or the session is closed.
                </p>
              )}
              {checkIn.isError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {checkIn.error.message}
                </p>
              )}
              <Button
                className="w-full"
                size="lg"
                disabled={!session || expired || checkIn.isPending}
                onClick={() => checkIn.mutate()}
              >
                {checkIn.isPending ? "Checking in…" : "Confirm My Attendance"}
              </Button>
              {session && !expired && (
                <p className="text-xs text-muted-foreground">
                  Checking in as <span className="font-medium">{user?.email}</span>
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}

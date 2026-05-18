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
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {checkIn.isSuccess ? <CheckCircle2 /> : <QrCode />}
          </div>
          <CardTitle>{checkIn.isSuccess ? "You are checked in" : "Attendance Check-In"}</CardTitle>
          <CardDescription>
            {session ? `${session.sessionName} · ${formatDateTime(session.sessionDate)}` : "Loading attendance session..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {expired && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">This QR check-in has expired or the session is closed.</p>}
          {checkIn.isError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{checkIn.error.message}</p>}
          {checkIn.isSuccess && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Your attendance has been recorded successfully.</p>}
          {!checkIn.isSuccess && (
            <Button className="w-full" disabled={!session || expired || checkIn.isPending} onClick={() => checkIn.mutate()}>
              Confirm My Attendance
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

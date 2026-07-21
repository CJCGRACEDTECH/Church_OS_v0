import React, { useState } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson, formatDateTime, type AttendanceSession } from "@/lib/attendance";
import { CheckCircle2, QrCode, UserRound } from "lucide-react";

export default function AttendanceCheckIn() {
  const [, params] = useRoute("/attendance/check-in/:token");
  const { user, isLoading } = useAuth();
  const token = params?.token ?? "";

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </main>
    );
  }

  return user ? (
    <MemberCheckIn token={token} userEmail={user.email} />
  ) : (
    <GuestCheckIn token={token} />
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-muted/30 p-4 gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.svg" alt="CJC Church" className="h-12 w-auto" />
        <p className="text-sm text-muted-foreground">Church OS · Attendance Check-In</p>
      </div>
      {children}
    </main>
  );
}

function MemberCheckIn({ token, userEmail }: { token: string; userEmail: string | null }) {
  const sessionQuery = useQuery({
    queryKey: ["qr-attendance-session", token],
    queryFn: () => apiJson<{ session: AttendanceSession; expired: boolean }>(`/attendance/qr/${token}`),
    enabled: Boolean(token),
  });
  const checkIn = useMutation({
    mutationFn: () => apiJson(`/attendance/qr/${token}/check-in`, { method: "POST", body: JSON.stringify({}) }),
  });

  const session = sessionQuery.data?.session;
  const expired = sessionQuery.data?.expired;

  return (
    <PageShell>
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
                  Checking in as <span className="font-medium">{userEmail}</span>
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </PageShell>
  );
}

function GuestCheckIn({ token }: { token: string }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [checkedIn, setCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["qr-attendance-session-public", token],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/qr/${token}/public`);
      if (!res.ok) throw new Error("Session not found.");
      return res.json() as Promise<{ session: AttendanceSession; expired: boolean }>;
    },
    enabled: Boolean(token),
  });

  const session = sessionQuery.data?.session;
  const expired = sessionQuery.data?.expired;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/attendance/qr/${token}/guest-check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Check-in failed. Please try again.");
      } else {
        setCheckedIn(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (id: keyof typeof form) => ({
    id,
    value: form[id],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [id]: e.target.value })),
  });

  return (
    <PageShell>
      <Card className="w-full max-w-md shadow-md">
        {checkedIn ? (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <CardTitle className="text-2xl text-emerald-700">Welcome!</CardTitle>
              <CardDescription className="text-base">
                {session?.sessionName ?? "Attendance session"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3 pb-8">
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Your attendance has been recorded. We're glad you're here!
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
                  <UserRound className="h-7 w-7" />
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
            <CardContent className="pb-8">
              {expired ? (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
                  This QR check-in has expired or the session is closed.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input {...field("firstName")} placeholder="Jane" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input {...field("lastName")} placeholder="Smith" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input {...field("email")} type="email" placeholder="jane@example.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input {...field("phone")} type="tel" placeholder="703-555-0100" required />
                  </div>
                  {error && (
                    <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={submitting || !session}
                  >
                    {submitting ? "Checking in…" : "Check In"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Already have an account?{" "}
                    <a href="/sign-in" className="underline underline-offset-2 hover:text-foreground">
                      Sign in instead
                    </a>
                  </p>
                </form>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </PageShell>
  );
}

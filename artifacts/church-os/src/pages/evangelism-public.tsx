import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, HeartHandshake, Loader2 } from "lucide-react";

type PublicOutreachEvent = {
  eventName: string;
  eventDate: string;
  location: string | null;
  publicContactPath: string;
  totalContacts: number;
};

type PublicContactForm = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  notes: string;
  contactConsent: boolean;
};

const emptyContactForm: PublicContactForm = {
  firstName: "",
  lastName: "",
  phoneNumber: "",
  email: "",
  notes: "",
  contactConsent: false,
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function publicApiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${basePath}/api${path}`, {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function publicContactUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${basePath}${path}`;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#eef0f8]">
      <header className="border-b border-white/10 bg-[#181d2e]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/sign-in" className="flex items-center gap-3">
            <img src={`${basePath}/cjc-logo.webp`} alt="CJC Church" className="h-10 w-auto" style={{ mixBlendMode: "screen" }} />
            <span className="font-semibold text-white">CJC Church</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">{children}</div>
    </main>
  );
}

function usePublicEvent(token: string | undefined, refreshMs?: number) {
  const [event, setEvent] = React.useState<PublicOutreachEvent | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return undefined;
    let active = true;
    let timer: number | undefined;

    async function load() {
      try {
        const data = await publicApiJson<{ event: PublicOutreachEvent }>(`/public/evangelism/events/${token}`);
        if (!active) return;
        setEvent(data.event);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Outreach event could not be loaded.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    if (refreshMs) timer = window.setInterval(() => void load(), refreshMs);
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [refreshMs, token]);

  return { event, isLoading, error, setEvent };
}

export function EvangelismQrPage() {
  const [, params] = useRoute("/evangelism/e/:token/qr");
  const { event, isLoading, error } = usePublicEvent(params?.token, 5000);
  const qrUrl = event ? publicContactUrl(event.publicContactPath) : "";

  return (
    <PublicShell>
      <Card className="mx-auto max-w-md overflow-hidden border-blue-100 shadow-xl">
        <CardContent className="flex min-h-[620px] flex-col items-center justify-center p-6 text-center">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
          ) : error || !event ? (
            <div>
              <h1 className="text-2xl font-semibold">QR page unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error ?? "This outreach event could not be found."}</p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <HeartHandshake className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-blue-700">{formatDate(event.eventDate)}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{event.eventName}</h1>
              <p className="mt-3 text-sm text-muted-foreground">Scan to connect with our church.</p>
              <div className="my-8 rounded-2xl border bg-white p-4 shadow-sm">
                <QRCodeSVG value={qrUrl} size={280} level="M" includeMargin />
              </div>
              <div className="w-full rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                <p className="text-sm font-medium text-blue-800">People Connected Today</p>
                <p className="mt-1 text-5xl font-bold text-blue-950">{event.totalContacts}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}

export function EvangelismContactPage() {
  const [, params] = useRoute("/evangelism/e/:token/contact");
  const { event, isLoading, error, setEvent } = usePublicEvent(params?.token);
  const [form, setForm] = React.useState<PublicContactForm>(emptyContactForm);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submittedName, setSubmittedName] = React.useState<string | null>(null);
  const set = (key: keyof PublicContactForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function onSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!params?.token) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await publicApiJson(`/public/evangelism/events/${params.token}/contacts`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSubmittedName(form.firstName);
      setForm(emptyContactForm);
      if (event) setEvent({ ...event, totalContacts: event.totalContacts + 1 });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Your contact form could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <Card className="mx-auto max-w-2xl overflow-hidden border-blue-100 shadow-xl">
        {isLoading ? (
          <CardContent className="flex min-h-[420px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
          </CardContent>
        ) : error || !event ? (
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-semibold">Form unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error ?? "This outreach event could not be found."}</p>
          </CardContent>
        ) : submittedName ? (
          <CardContent className="flex min-h-[460px] flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-700">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold">Thank you, {submittedName}</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your information was received. Someone from the church team can follow up with you soon.</p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b bg-white">
              <p className="text-sm font-medium text-blue-700">{event.eventName}</p>
              <CardTitle className="text-2xl">Connect With Us</CardTitle>
              <CardDescription>{formatDate(event.eventDate)}{event.location ? ` · ${event.location}` : ""}</CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <form className="space-y-5" onSubmit={onSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input autoComplete="given-name" value={form.firstName} onChange={(event) => set("firstName", event.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input autoComplete="family-name" value={form.lastName} onChange={(event) => set("lastName", event.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input type="tel" autoComplete="tel" value={form.phoneNumber} onChange={(event) => set("phoneNumber", event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Email <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Input type="email" autoComplete="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prayer Request / Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={4} />
                </div>
                <label className="flex gap-3 rounded-lg border bg-slate-50 p-3 text-sm">
                  <Checkbox checked={form.contactConsent} onCheckedChange={(checked) => set("contactConsent", checked === true)} />
                  <span>I agree to be contacted by the church.</span>
                </label>
                {submitError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}
                <Button className="h-11 w-full" disabled={isSubmitting || !form.contactConsent}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </PublicShell>
  );
}

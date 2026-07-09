import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ShieldCheck } from "lucide-react";

type AccountRequestFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  preferredContactMethod: string;
  reason: string;
};

const emptyForm: AccountRequestFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  preferredContactMethod: "",
  reason: "",
};

async function submitAccountRequest(form: AccountRequestFormState, basePath: string) {
  const response = await fetch(`${basePath}/api/public/account-request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Your account request could not be submitted.");
  return data as { request: { firstName: string; churchName: string; matchedExistingProfile: boolean } };
}

function RequiredBadge({ required }: { required?: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
      required ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
    }`}>
      {required ? "Required" : "Optional"}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <RequiredBadge required={required} />
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="border-slate-200 bg-white/90 focus-visible:ring-blue-300"
      />
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function RequestAccountPage() {
  const [form, setForm] = React.useState<AccountRequestFormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmation, setConfirmation] = React.useState<{ firstName: string; matchedExistingProfile: boolean } | null>(null);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const set = (key: keyof AccountRequestFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const data = await submitAccountRequest(form, basePath);
      setConfirmation({
        firstName: data.request.firstName,
        matchedExistingProfile: data.request.matchedExistingProfile,
      });
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your account request could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef0f8]">
      <header className="border-b border-white/10 bg-[#181d2e]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/sign-in" className="flex items-center gap-3">
            <img src={`${basePath}/cjc-logo.webp`} alt="CJC Church" className="h-10 w-auto" style={{ mixBlendMode: "screen" }} />
            <span className="font-semibold text-white">CJC Church</span>
          </Link>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href="/connect">Connect With Us</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[0.8fr_1.45fr]">
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Request Member Account</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use this if you are already connected to CJC Church and need access to your Church OS member account.
            </p>
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-slate-700">
              Access is reviewed by church admins. Submitting this form does not create login access automatically.
            </div>
          </div>
        </section>

        <Card className="overflow-hidden border-slate-200 shadow-xl">
          {confirmation ? (
            <CardContent className="flex min-h-[520px] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-700">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Thank you, {confirmation.firstName}</h2>
                <p className="mt-2 text-muted-foreground">
                  Your request was sent to the church admin inbox. A team member will review it and follow up.
                </p>
              </div>
              <Button onClick={() => setConfirmation(null)}>Submit Another Request</Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-slate-100 bg-white">
                <CardTitle className="text-slate-950">Account Access Request</CardTitle>
                <CardDescription>Help admins match you to the correct member profile.</CardDescription>
              </CardHeader>
              <CardContent className="bg-white p-5 md:p-6">
                <form className="space-y-6" onSubmit={onSubmit}>
                  <FormSection title="Identify Yourself" description="Use the same email or phone number your church profile may already have.">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="First Name" value={form.firstName} onChange={(value) => set("firstName", value)} required />
                      <Field label="Last Name" value={form.lastName} onChange={(value) => set("lastName", value)} required />
                      <Field label="Email" type="email" value={form.email} onChange={(value) => set("email", value)} required />
                      <Field label="Phone" type="tel" value={form.phoneNumber} onChange={(value) => set("phoneNumber", value)} required />
                    </div>
                  </FormSection>

                  <FormSection title="Request Details" description="This helps the admin team verify and respond to the request.">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <span>Preferred Contact</span>
                          <RequiredBadge />
                        </Label>
                        <select
                          value={form.preferredContactMethod}
                          onChange={(event) => set("preferredContactMethod", event.target.value)}
                          className="h-10 w-full rounded-md border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select contact preference</option>
                          <option value="phone">Phone Call</option>
                          <option value="text">Text Message</option>
                          <option value="email">Email</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span>Reason For Request</span>
                        <RequiredBadge />
                      </Label>
                      <Textarea
                        value={form.reason}
                        onChange={(event) => set("reason", event.target.value)}
                        rows={4}
                        className="border-slate-200 bg-white/90 focus-visible:ring-blue-300"
                        placeholder="Example: I am a member and need access to my profile."
                      />
                    </div>
                  </FormSection>

                  {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                  <Button type="submit" disabled={isSubmitting} className="w-full bg-[#181d2e] hover:bg-[#253050]">
                    {isSubmitting ? "Submitting..." : "Submit Account Request"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

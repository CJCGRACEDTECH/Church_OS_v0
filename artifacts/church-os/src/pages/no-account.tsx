import { MailX, ArrowLeft } from "lucide-react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";

type Reason = "no-account" | "inactive" | "email-conflict" | string;

const MESSAGES: Record<string, { title: string; body: string; hint: string }> = {
  "no-account": {
    title: "Invitation Expired",
    body: "Your sign-in was successful, but your Church OS invitation expired before you could activate your account. Invitations are only valid for 72 hours.",
    hint: "Ask your church administrator to send you a new invitation. Once you receive it, open the link and accept it within 72 hours.",
  },
  "inactive": {
    title: "Account Deactivated",
    body: "Your Church OS account is currently inactive and cannot be used to sign in.",
    hint: "Contact your church administrator to have your account re-activated.",
  },
  "email-conflict": {
    title: "Sign-in Method Mismatch",
    body: "An account with this email already exists but is linked to a different sign-in method.",
    hint: "Try signing in with a different method, or contact your church administrator for help.",
  },
};

const FALLBACK = MESSAGES["no-account"];

export default function NoAccount() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const reason: Reason = params.get("reason") ?? "no-account";
  const { title, body, hint } = MESSAGES[reason] ?? FALLBACK;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md w-full">
        {/* Icon */}
        <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <MailX className="h-10 w-10 text-amber-600" />
        </div>

        {/* Heading + body */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground leading-relaxed">{body}</p>
        </div>

        {/* Steps card */}
        <div className="w-full rounded-xl border bg-muted/40 p-5 text-left space-y-3">
          <p className="text-sm font-semibold text-foreground">What to do next</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{hint}</p>
        </div>

        {/* CTA */}
        <Button asChild variant="outline" className="gap-2">
          <Link href="/sign-in">
            <ArrowLeft className="h-4 w-4" />
            Back to sign-in
          </Link>
        </Button>
      </div>
    </div>
  );
}

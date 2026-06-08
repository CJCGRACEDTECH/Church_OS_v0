import React from "react";
import { Clock } from "lucide-react";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function ComingSoonPage({
  title,
  description,
  icon: Icon,
}: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
              {Icon ? <Icon className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Member Portal</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="truncate text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
            Not enabled
          </div>
        </div>
      </section>

      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border bg-muted/50">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">This section is not enabled</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your church administrator can enable this area when the ministry workflow is ready.
        </p>
      </div>
    </div>
  );
}

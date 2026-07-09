import React from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
};

export default function PageHeader({ eyebrow, title, description, icon, actions }: PageHeaderProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-300 to-amber-300" />
      <div className="flex flex-col justify-between gap-5 p-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          {icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p>}
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>}
      </div>
    </section>
  );
}

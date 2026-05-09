import React, { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card className="border-border/50 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-center p-6">
      <CardContent className="flex flex-col items-center gap-4 p-0">
        <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center">
          <Icon className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
        </div>
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}

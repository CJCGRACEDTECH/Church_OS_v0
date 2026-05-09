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
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            {Icon ? (
              <Icon className="h-10 w-10 text-muted-foreground" />
            ) : (
              <Clock className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">
            Soon
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
          <Clock className="h-4 w-4" />
          <span>Planned for an upcoming sprint</span>
        </div>
      </div>
    </div>
  );
}

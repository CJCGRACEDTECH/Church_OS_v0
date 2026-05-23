import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  href?: string;
  loading?: boolean;
  error?: boolean;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, trend, href, loading, error, icon }: StatCardProps) {
  const inner = (
    <Card className={`border-border/50 shadow-sm transition-colors ${href ? "hover:border-primary/30 hover:shadow-md cursor-pointer" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          {label}
        </CardTitle>
        {error && <AlertCircle className="h-4 w-4 text-destructive/60 shrink-0" aria-label="Could not load" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
            <div className="h-3 w-28 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{error ? "—" : value}</div>
            {trend && (
              <p className="text-xs text-muted-foreground mt-1">{trend}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href && !loading) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

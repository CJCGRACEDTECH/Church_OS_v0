import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
}

export default function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

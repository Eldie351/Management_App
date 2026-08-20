import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  loading?: boolean;
}

export default function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
  loading = false,
}: DashboardCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-7 w-32" />
            {description && <Skeleton className="mt-2 h-3 w-40" />}
          </>
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

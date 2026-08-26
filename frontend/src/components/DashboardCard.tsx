import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

type Accent = "indigo" | "violet" | "amber" | "rose" | "emerald";

const accentStyles: Record<Accent, { chip: string; icon: string }> = {
  indigo: { chip: "bg-indigo-50", icon: "text-indigo-600" },
  violet: { chip: "bg-violet-50", icon: "text-violet-600" },
  amber: { chip: "bg-amber-50", icon: "text-amber-600" },
  rose: { chip: "bg-rose-50", icon: "text-rose-600" },
  emerald: { chip: "bg-emerald-50", icon: "text-emerald-600" },
};

interface DashboardCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  accent?: Accent;
  loading?: boolean;
}

export default function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "indigo",
  loading = false,
}: DashboardCardProps) {
  const styles = accentStyles[accent];

  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <>
              <Skeleton className="mt-2 h-7 w-20" />
              {description && <Skeleton className="mt-2 h-3 w-32" />}
            </>
          ) : (
            <>
              <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                {value}
              </div>
              {description && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </>
          )}
        </div>
        {Icon && (
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${styles.chip}`}>
            <Icon className={`size-5 ${styles.icon}`} />
          </span>
        )}
      </CardContent>
    </Card>
  );
}

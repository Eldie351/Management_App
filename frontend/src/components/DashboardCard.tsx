import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

type Accent = "indigo" | "violet" | "amber" | "rose" | "emerald";

const accentStyles: Record<Accent, { chip: string; icon: string; value: string; border: string }> = {
  indigo: { chip: "bg-indigo-50", icon: "text-indigo-600", value: "text-indigo-600", border: "border-indigo-200" },
  violet: { chip: "bg-violet-50", icon: "text-violet-600", value: "text-violet-600", border: "border-violet-200" },
  amber: { chip: "bg-amber-50", icon: "text-amber-600", value: "text-amber-600", border: "border-amber-200" },
  rose: { chip: "bg-rose-50", icon: "text-rose-600", value: "text-rose-600", border: "border-rose-200" },
  emerald: { chip: "bg-emerald-50", icon: "text-emerald-600", value: "text-emerald-600", border: "border-emerald-200" },
};

const neutralStyles = {
  chip: "bg-slate-100",
  icon: "text-slate-400",
  value: "text-slate-900",
  border: "",
};

interface DashboardCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  accent?: Accent;
  loading?: boolean;
  // Quand `alert` est activé, la case reste neutre (grise) tant que `value`
  // vaut 0, et ne prend la couleur de `accent` qu'à partir de 1 — pour les
  // compteurs d'alerte (tickets en attente, ruptures, stock faible).
  alert?: boolean;
}

export default function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "indigo",
  loading = false,
  alert = false,
}: DashboardCardProps) {
  const isActive = !alert || Number(value) > 0;
  const styles = isActive ? accentStyles[accent] : neutralStyles;

  return (
    <Card className={`shadow-sm transition-colors ${isActive && alert ? `border-2 ${styles.border}` : ""}`}>
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
              <div className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${alert ? styles.value : ""}`}>
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

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  bgColor?: string;
  iconColor?: string;
}

export default function StatCard({ title, value, icon: Icon, trend, trendUp, bgColor, iconColor }: StatCardProps) {
  return (
    <Card className={cn("card-hover border border-border/50 shadow-sm overflow-hidden relative", bgColor)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-2 truncate tracking-tight">{value}</p>
            {trend && (
              <p className={cn("text-xs mt-2 font-medium flex items-center gap-1", trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {trendUp ? "↑" : "↓"} {trend}
              </p>
            )}
          </div>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ml-3", iconColor || "bg-gradient-primary")}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

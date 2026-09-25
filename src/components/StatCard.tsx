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
    <Card className={cn("card-hover border-0 border-t-2 border-t-primary/70 shadow-sm rounded-sm overflow-hidden relative bg-card", bgColor)}>
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="tracked-label text-[10px] font-semibold uppercase text-muted-foreground">{title}</p>
            <p className="figure text-sm font-semibold text-[12px] mt-2 break-words">{value}</p>
            {trend && (
              <p className={cn("figure text-[11px] mt-2 font-medium flex items-center gap-1", trendUp ? "text-secondary" : "text-destructive")}>
                {trendUp ? "▲" : "▼"} {trend}
              </p>
            )}
          </div>
          <div className={cn("w-8 h-8 rounded-sm border-2 flex items-center justify-center flex-shrink-0", iconColor || "border-primary/40 bg-primary/10 text-primary")}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

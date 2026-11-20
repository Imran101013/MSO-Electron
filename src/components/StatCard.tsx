import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  /** A plain line under the value (no arrow), e.g. the date a figure is for. */
  note?: string;
  bgColor?: string;
  /** Tone classes for the icon; only its text colours are used (e.g. "text-secondary"). */
  iconColor?: string;
}

/** A balance slip: what it is, the figure, and (ruled off below it) a note when there is one. */
export default function StatCard({ title, value, icon: Icon, trend, trendUp, note, bgColor, iconColor }: StatCardProps) {
  const iconText = (iconColor || "text-primary").split(/\s+/).filter((c) => /^(dark:)?text-/.test(c)).join(" ");
  return (
    <Card className={cn("card-hover rounded-sm border border-border bg-card shadow-sm", bgColor)}>
      <CardContent className="flex h-full flex-col p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium leading-tight text-muted-foreground">
          <Icon className={cn("size-3.5 shrink-0", iconText)} aria-hidden />
          <span className="min-w-0">{title}</span>
        </p>
        <p className="figure mt-2 break-words text-2xl font-semibold leading-tight text-foreground">{value}</p>
        {(trend || note) && (
          <div className="mt-2.5 border-t border-ledger-rule pt-1.5">
            {trend && (
              <p className={cn("figure flex items-center gap-1 text-xs font-medium", trendUp ? "text-secondary" : "text-destructive")}>
                {trendUp ? "▲" : "▼"} {trend}
              </p>
            )}
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

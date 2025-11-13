import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  bgColor?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  bgColor,
}: StatCardProps) {
  return (
    <Card
      className={`shadow-md hover:shadow-lg transition-shadow ${
        bgColor || ""
      }`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
            {trend && (
              <p
                className={`text-sm mt-2 ${
                  trendUp ? "text-secondary" : "text-destructive"
                }`}>
                {trend}
              </p>
            )}
          </div>
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

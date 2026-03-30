import { Card, CardContent } from "@/components/ui/shared";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
  bg?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  color = "text-primary",
  bg = "bg-primary/10",
  className,
}: StatsCardProps) {
  return (
    <Card
      className={cn(
        "glass-panel overflow-hidden relative group card-spec",
        className
      )}
    >
      <div
        className={cn(
          "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40",
          bg.replace("/10", "")
        )}
      />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <h3 className="text-3xl font-bold font-mono text-white">{value}</h3>
          </div>
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              bg
            )}
          >
            <Icon className={cn("h-6 w-6", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

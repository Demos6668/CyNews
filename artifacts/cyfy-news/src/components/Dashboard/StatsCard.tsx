import { Card, CardContent } from "@/components/ui/shared";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
  /** Tailwind class with opacity for icon background, e.g. "bg-primary/10" */
  bg?: string;
  /** Solid Tailwind class for glow circle (no opacity), e.g. "bg-primary". Defaults to stripping opacity from `bg`. */
  glowBg?: string;
  className?: string;
  /** e.g. "+12%" or "-3" */
  delta?: string;
  /** drives the trend arrow color and icon */
  trend?: "up" | "down" | "flat";
  /** href makes the card clickable via a wrapper — parent handles this */
  href?: string;
}

const TrendIcon = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

const trendColor = {
  up: "text-destructive",   // more threats = bad
  down: "text-success",     // fewer threats = good
  flat: "text-muted-foreground",
} as const;

export function StatsCard({
  title,
  value,
  icon: Icon,
  color = "text-primary",
  bg = "bg-primary/10",
  glowBg,
  className,
  delta,
  trend = "flat",
}: StatsCardProps) {
  // Derive glow class: caller can pass explicit glowBg, otherwise strip /NN opacity suffix
  const resolvedGlowBg = glowBg ?? bg.replace(/\/\d+$/, "");
  const TIcon = TrendIcon[trend];
  const tColor = trendColor[trend];

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
          resolvedGlowBg
        )}
      />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              {title}
            </p>
            <h3 className="text-[28px] font-bold text-num text-white leading-none">
              {value}
            </h3>
            {delta && (
              <div className={cn("flex items-center gap-1 mt-1.5 text-xs font-medium", tColor)}>
                <TIcon className="h-3 w-3" />
                <span>{delta}</span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              bg
            )}
          >
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

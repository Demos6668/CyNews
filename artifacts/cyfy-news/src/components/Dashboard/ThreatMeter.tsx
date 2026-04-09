import { Card, CardContent } from "@/components/ui/shared";
import { cn } from "@/lib/utils";

const LEVELS = ["low", "medium", "high", "critical"] as const;
const COLORS = ["#3FB950", "#F0C000", "#FFB74B", "#F85149"]; // green, yellow, amber, red (teal-to-amber-to-red gradient spectrum)

interface ThreatMeterProps {
  level: string;
  criticalAlerts?: number;
  highAlerts?: number;
  mediumAlerts?: number;
  className?: string;
}

export function ThreatMeter({ level, criticalAlerts = 0, highAlerts = 0, mediumAlerts = 0, className }: ThreatMeterProps) {
  const idx = LEVELS.indexOf(level as (typeof LEVELS)[number]);
  const effectiveIdx = idx >= 0 ? idx : 0;
  const angle = -90 + (effectiveIdx / (LEVELS.length - 1)) * 180;
  const color = COLORS[effectiveIdx] ?? COLORS[0];

  return (
    <Card className={cn("glass-panel w-full max-w-sm", className)}>
      <CardContent className="p-6 flex flex-col items-center">
        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">
          Threat Level
        </h3>
        <div className="relative w-48 h-28 overflow-hidden">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            {/* Background arc */}
            <defs>
              <linearGradient
                id="threatGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#0095AF" />
                <stop offset="33%" stopColor="#FFB74B" />
                <stop offset="66%" stopColor="#F0C000" />
                <stop offset="100%" stopColor="#F85149" />
              </linearGradient>
            </defs>
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {LEVELS.map((_, i) => {
              const startAngle = -180 + (i / LEVELS.length) * 180;
              const endAngle = -180 + ((i + 1) / LEVELS.length) * 180;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const x1 = 100 + 80 * Math.cos(startRad);
              const y1 = 100 + 80 * Math.sin(startRad);
              const x2 = 100 + 80 * Math.cos(endRad);
              const y2 = 100 + 80 * Math.sin(endRad);
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} A 80 80 0 0 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={COLORS[i]}
                  strokeWidth="16"
                  strokeLinecap="round"
                  opacity={i <= effectiveIdx ? 1 : 0.15}
                  className="transition-opacity duration-300"
                />
              );
            })}
            <line
              x1="100"
              y1="100"
              x2={100 + 55 * Math.cos((angle * Math.PI) / 180)}
              y2={100 + 55 * Math.sin((angle * Math.PI) / 180)}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="6" fill={color} />
          </svg>
        </div>
        <div className="text-center mt-2">
          <span
            className="text-lg font-bold font-mono uppercase tracking-wider"
            style={{ color }}
          >
            {level}
          </span>
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-muted-foreground w-full justify-center">
          <span><span className="font-semibold text-num text-destructive">{criticalAlerts}</span> Crit</span>
          <span><span className="font-semibold text-num text-accent">{highAlerts}</span> High</span>
          <span><span className="font-semibold text-num text-warning">{mediumAlerts}</span> Med</span>
        </div>
      </CardContent>
    </Card>
  );
}

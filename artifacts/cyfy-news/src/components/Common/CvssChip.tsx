import { cn } from "@/lib/utils";
import { getCvssHex, getCvssTailwind, getCvssSeverityLabel } from "@/lib/design-tokens";

interface CvssChipProps {
  score: number;
  /** Show the severity label below the score */
  showLabel?: boolean;
  /** Extra className for the outer wrapper */
  className?: string;
  size?: "sm" | "md";
}

/**
 * A single source-of-truth CVSS chip used in AdvisoryCard, AdvisoryDetail,
 * and CertInAdvisoryCard. Shows the numeric score with a severity-colored
 * border and a thin SVG progress ring.
 */
export function CvssChip({ score, showLabel = false, className, size = "md" }: CvssChipProps) {
  const hex = getCvssHex(score);
  const textClass = getCvssTailwind(score);
  const label = getCvssSeverityLabel(score);

  const dim = size === "sm" ? 40 : 48;
  const r = (dim / 2) - 4;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(score / 10, 1) * circ;

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <div
        className="relative shrink-0"
        style={{ width: dim, height: dim }}
        title={`CVSS ${score.toFixed(1)} — ${label}`}
      >
        <svg
          viewBox={`0 0 ${dim} ${dim}`}
          width={dim}
          height={dim}
          className="absolute inset-0 -rotate-90"
        >
          {/* track */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={3}
          />
          {/* fill */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={hex}
            strokeWidth={3}
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-num font-bold leading-none",
              size === "sm" ? "text-[11px]" : "text-[13px]",
              textClass
            )}
          >
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className={cn("text-[9px] uppercase tracking-wider font-semibold", textClass)}>
          {label}
        </span>
      )}
    </div>
  );
}

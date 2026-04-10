import { cn } from "@/lib/utils";
import { getSeverityToken } from "@/lib/design-tokens";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

interface SeverityBadgeProps {
  severity: Severity | string;
  className?: string;
  children?: React.ReactNode;
  /** Show a small color dot before the label (default true) */
  showDot?: boolean;
}

export function SeverityBadge({
  severity,
  className,
  children,
  showDot = true,
}: SeverityBadgeProps) {
  const token = getSeverityToken(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase",
        token.bg,
        token.fg,
        token.border,
        className
      )}
      aria-label={`Severity: ${severity}`}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", token.dot)}
          aria-hidden="true"
        />
      )}
      {children ?? String(severity).toUpperCase()}
    </span>
  );
}

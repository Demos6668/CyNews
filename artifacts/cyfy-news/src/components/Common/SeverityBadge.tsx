import { cn } from "@/lib/utils";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

interface SeverityBadgeProps {
  severity: Severity | string;
  className?: string;
  children?: React.ReactNode;
}

function getSeverityBadgeClasses(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "high":
      return "bg-accent/20 text-accent border-accent/30";
    case "medium":
      return "bg-warning/20 text-warning border-warning/30";
    case "low":
      return "bg-success/20 text-success border-success/30";
    case "info":
    default:
      return "bg-primary/20 text-primary border-primary/30";
  }
}

export function SeverityBadge({
  severity,
  className,
  children,
}: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase",
        getSeverityBadgeClasses(severity),
        className
      )}
      aria-label={`Severity: ${severity}`}
    >
      {children ?? String(severity).toUpperCase()}
    </span>
  );
}

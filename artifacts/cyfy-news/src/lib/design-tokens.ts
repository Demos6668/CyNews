/**
 * Single source of truth for severity colors, CVSS bands, and elevation levels.
 * All components must read from here instead of duplicating switch statements.
 */

export interface SeverityToken {
  fg: string;        // text color (Tailwind class)
  bg: string;        // background tint (Tailwind class)
  border: string;    // border color (Tailwind class)
  ring: string;      // focus ring (Tailwind class)
  dot: string;       // solid dot bg (Tailwind class)
  hex: string;       // raw hex for SVG / inline styles
  label: string;     // display label
}

export const SEVERITY_TOKENS: Record<string, SeverityToken> = {
  critical: {
    fg: "text-destructive",
    bg: "bg-destructive/15",
    border: "border-destructive/30",
    ring: "ring-destructive/40",
    dot: "bg-destructive",
    hex: "#F85149",
    label: "Critical",
  },
  high: {
    fg: "text-accent",
    bg: "bg-accent/15",
    border: "border-accent/30",
    ring: "ring-accent/40",
    dot: "bg-accent",
    hex: "#FFB74B",
    label: "High",
  },
  medium: {
    fg: "text-warning",
    bg: "bg-warning/15",
    border: "border-warning/30",
    ring: "ring-warning/40",
    dot: "bg-warning",
    hex: "#F0C000",
    label: "Medium",
  },
  low: {
    fg: "text-success",
    bg: "bg-success/15",
    border: "border-success/30",
    ring: "ring-success/40",
    dot: "bg-success",
    hex: "#3FB950",
    label: "Low",
  },
  info: {
    fg: "text-primary",
    bg: "bg-primary/15",
    border: "border-primary/30",
    ring: "ring-primary/40",
    dot: "bg-primary",
    hex: "#0095AF",
    label: "Info",
  },
};

export function getSeverityToken(severity: string): SeverityToken {
  return SEVERITY_TOKENS[severity.toLowerCase()] ?? SEVERITY_TOKENS.info;
}

/** Returns a hex color for a CVSS score (0-10) */
export function getCvssHex(score: number): string {
  if (score >= 9.0) return "#F85149"; // critical
  if (score >= 7.0) return "#FFB74B"; // high
  if (score >= 4.0) return "#F0C000"; // medium
  return "#3FB950";                    // low
}

/** Returns Tailwind text-color class for a CVSS score */
export function getCvssTailwind(score: number): string {
  if (score >= 9.0) return "text-destructive";
  if (score >= 7.0) return "text-accent";
  if (score >= 4.0) return "text-warning";
  return "text-success";
}

/** Maps CVSS score to severity label */
export function getCvssSeverityLabel(score: number): string {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

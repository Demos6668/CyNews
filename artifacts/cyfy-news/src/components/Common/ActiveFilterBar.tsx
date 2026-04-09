import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
  color?: "default" | "severity" | "category" | "vendor" | "status";
}

interface ActiveFilterBarProps {
  filters: ActiveFilter[];
  onClearAll?: () => void;
  className?: string;
}

const colorClass: Record<NonNullable<ActiveFilter["color"]>, string> = {
  default: "bg-primary/15 text-primary border-primary/25",
  severity: "bg-primary/15 text-primary border-primary/25",
  category: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  vendor: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  status: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

export function ActiveFilterBar({ filters, onClearAll, className }: ActiveFilterBarProps) {
  if (filters.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap py-2 px-3 rounded-lg bg-muted/30 border border-border/40",
        className
      )}
      role="group"
      aria-label="Active filters"
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono shrink-0">
        Filters:
      </span>
      {filters.map((f) => (
        <span
          key={f.key}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium",
            colorClass[f.color ?? "default"]
          )}
        >
          {f.label}
          <button
            type="button"
            onClick={f.onRemove}
            aria-label={`Remove ${f.label} filter`}
            className="hover:opacity-70 transition-opacity ml-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0 font-mono"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

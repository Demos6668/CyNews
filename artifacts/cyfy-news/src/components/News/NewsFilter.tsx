import { Button } from "@/components/ui/shared";
import { Filter, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/components/Common/SeverityBadge";

const SEVERITY_OPTIONS: { label: string; value: Severity }[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "info" },
];

const CATEGORY_OPTIONS = [
  "Ransomware",
  "Vulnerability",
  "Zero-Day",
  "Phishing",
  "APT Activity",
  "Data Breach",
  "Infrastructure Threat",
  "Malware",
  "CERT Advisory",
  "Supply Chain",
  "Compliance",
  "IoT Vulnerability",
  "Disinformation",
];

interface NewsFilterProps {
  severity?: Severity;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  showFilters: boolean;
  onSeverityChange: (severity: Severity | undefined) => void;
  onCategoryChange: (category: string | undefined) => void;
  onDateRangeChange: (from: string | undefined, to: string | undefined) => void;
  onShowFiltersToggle: () => void;
  onClearFilters: () => void;
  className?: string;
}

export function NewsFilter({
  severity,
  category,
  dateFrom,
  dateTo,
  showFilters,
  onSeverityChange,
  onCategoryChange,
  onDateRangeChange,
  onShowFiltersToggle,
  onClearFilters,
  className,
}: NewsFilterProps) {
  const hasActiveFilters = severity || category || dateFrom || dateTo;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          className="gap-2"
          onClick={onShowFiltersToggle}
        >
          <Filter size={16} /> Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {[severity, category].filter(Boolean).length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={onClearFilters}
          >
            <X size={14} /> Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 bg-card/50 rounded-xl border border-white/5">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-20">
              Severity:
            </span>
            {SEVERITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={severity === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onSeverityChange(severity === opt.value ? undefined : opt.value)
                }
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-20">
              Category:
            </span>
            {CATEGORY_OPTIONS.map((cat) => (
              <Button
                key={cat}
                variant={category === cat ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onCategoryChange(category === cat ? undefined : cat)
                }
                className="text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-20 flex items-center gap-1">
              <Calendar size={12} /> Date:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom ?? ""}
                onChange={(e) =>
                  onDateRangeChange(e.target.value || undefined, dateTo)
                }
                className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:border-primary outline-none"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={dateTo ?? ""}
                onChange={(e) =>
                  onDateRangeChange(dateFrom, e.target.value || undefined)
                }
                className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

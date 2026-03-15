import { useState } from "react";
import { Button } from "@/components/ui/shared";
import { Filter, X, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "./SeverityBadge";

const SEVERITY_OPTIONS: { label: string; value: Severity; color?: string }[] = [
  { label: "Critical", value: "critical", color: "bg-destructive" },
  { label: "High", value: "high", color: "bg-accent" },
  { label: "Medium", value: "medium", color: "bg-warning" },
  { label: "Low", value: "low", color: "bg-success" },
  { label: "Info", value: "info", color: "bg-primary" },
];

export type FilterSectionVariant = "news" | "threats" | "advisories";

interface FilterSectionBaseProps {
  severities: string[];
  onToggleSeverity: (value: string) => void;
  onClearAll: () => void;
  showFilters: boolean;
  onShowFiltersToggle: () => void;
  activeCount: number;
  className?: string;
}

interface NewsFilterProps extends FilterSectionBaseProps {
  variant: "news";
  categories: string[];
  categoryOptions: string[];
  onToggleCategory: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateChange: (from: string | undefined, to: string | undefined) => void;
  onApplyPreset?: (filters: { severities: string[]; categories: string[] }) => void;
}

interface ThreatsFilterProps extends FilterSectionBaseProps {
  variant: "threats";
  categories: string[];
  categoryOptions: string[];
  onToggleCategory: (value: string) => void;
  onApplyPreset?: (filters: { severities: string[]; categories: string[] }) => void;
}

interface AdvisoriesFilterProps extends FilterSectionBaseProps {
  variant: "advisories";
  statuses: string[];
  statusOptions: { label: string; value: string }[];
  onToggleStatus: (value: string) => void;
  vendors: string[];
  vendorOptions: string[];
  onToggleVendor: (value: string) => void;
}

export type FilterSectionProps = NewsFilterProps | ThreatsFilterProps | AdvisoriesFilterProps;

const QUICK_PRESETS: { id: string; label: string; severities: string[]; categories: string[] }[] = [
  { id: "critical-only", label: "Critical Only", severities: ["critical"], categories: [] },
  { id: "critical-high", label: "Critical + High", severities: ["critical", "high"], categories: [] },
  { id: "ransomware", label: "Ransomware", severities: [], categories: ["Ransomware"] },
  { id: "apt-zero-day", label: "APT & Zero-Day", severities: [], categories: ["APT Activity", "Zero-Day"] },
  { id: "data-breach", label: "Data Breaches", severities: [], categories: ["Data Breach"] },
  { id: "cert-advisory", label: "CERT Advisories", severities: [], categories: ["CERT Advisory"] },
  { id: "critical-ransomware", label: "Critical Ransomware", severities: ["critical"], categories: ["Ransomware"] },
];

function FilterChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  renderOption,
  accentClass = "bg-primary",
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
  renderOption?: (opt: T) => React.ReactNode;
  accentClass?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {label}
          {selected.length > 0 && (
            <span className={cn("ml-2", accentClass === "bg-primary" ? "text-primary" : "text-amber-500")}>
              ({selected.length} selected)
            </span>
          )}
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => selected.forEach((s) => onToggle(s))}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <Button
              key={opt}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onToggle(opt)}
              className="text-xs"
            >
              {renderOption ? renderOption(opt) : opt}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterSection(props: FilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const {
    severities,
    onToggleSeverity,
    onClearAll,
    showFilters,
    onShowFiltersToggle,
    activeCount,
    className,
  } = props;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          className="gap-2"
          onClick={onShowFiltersToggle}
        >
          <Filter size={16} /> Filters
          {activeCount > 0 && (
            <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {activeCount}
            </span>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onClearAll}>
            <X size={14} /> Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="space-y-6 p-4 bg-card/50 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isExpanded ? "Collapse" : "Expand"} filter options
          </button>

          {isExpanded && (
            <div className="space-y-6">
              {(props.variant === "news" || props.variant === "threats") && props.onApplyPreset && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">
                    Quick Filters
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PRESETS.map((preset) => {
                      const isActive =
                        preset.severities.length === severities.length &&
                        preset.severities.every((s) => severities.includes(s)) &&
                        preset.categories.length === props.categories.length &&
                        preset.categories.every((c) => props.categories.includes(c));
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => props.onApplyPreset?.({ severities: preset.severities, categories: preset.categories })}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <FilterChipGroup
                label="Severity"
                options={SEVERITY_OPTIONS.map((o) => o.value)}
                selected={severities}
                onToggle={onToggleSeverity}
                renderOption={(v) => {
                  const opt = SEVERITY_OPTIONS.find((o) => o.value === v);
                  return (
                    <span className="flex items-center gap-2">
                      {opt?.color && <span className={cn("w-2 h-2 rounded-full", opt.color)} />}
                      {opt?.label ?? v}
                    </span>
                  );
                }}
              />

              {props.variant === "news" && (
                <>
                  <FilterChipGroup
                    label="Category"
                    options={props.categoryOptions}
                    selected={props.categories}
                    onToggle={props.onToggleCategory}
                    accentClass="bg-amber-500"
                  />
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block flex items-center gap-1">
                      <Calendar size={12} /> Date range
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={props.dateFrom ?? ""}
                        onChange={(e) => props.onDateChange(e.target.value || undefined, props.dateTo)}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:border-primary outline-none"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <input
                        type="date"
                        value={props.dateTo ?? ""}
                        onChange={(e) => props.onDateChange(props.dateFrom, e.target.value || undefined)}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:border-primary outline-none"
                      />
                      {(props.dateFrom || props.dateTo) && (
                        <button
                          type="button"
                          onClick={() => props.onDateChange(undefined, undefined)}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {props.variant === "threats" && (
                <FilterChipGroup
                  label="Category"
                  options={props.categoryOptions}
                  selected={props.categories}
                  onToggle={props.onToggleCategory}
                  accentClass="bg-amber-500"
                />
              )}

              {props.variant === "advisories" && (
                <>
                  <FilterChipGroup
                    label="Status"
                    options={props.statusOptions.map((o) => o.value)}
                    selected={props.statuses}
                    onToggle={props.onToggleStatus}
                  />
                  <FilterChipGroup
                    label="Vendor"
                    options={props.vendorOptions}
                    selected={props.vendors}
                    onToggle={props.onToggleVendor}
                  />
                </>
              )}

              {activeCount > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {severities.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full"
                      >
                        {s}
                        <button type="button" onClick={() => onToggleSeverity(s)} className="hover:opacity-80">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {(props.variant === "news" || props.variant === "threats") &&
                      props.categories.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-full"
                        >
                          {c}
                          <button type="button" onClick={() => props.onToggleCategory(c)} className="hover:opacity-80">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    {props.variant === "advisories" &&
                      props.statuses.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full"
                        >
                          {s}
                          <button type="button" onClick={() => props.onToggleStatus(s)} className="hover:opacity-80">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    {props.variant === "advisories" &&
                      props.vendors.map((v) => (
                        <span
                          key={v}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full"
                        >
                          {v}
                          <button type="button" onClick={() => props.onToggleVendor(v)} className="hover:opacity-80">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

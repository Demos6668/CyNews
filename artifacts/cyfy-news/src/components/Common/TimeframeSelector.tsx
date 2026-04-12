import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TimeframeValue = "1h" | "6h" | "24h" | "7d" | "30d" | "all";

const OPTIONS: { value: TimeframeValue; label: string }[] = [
  { value: "1h", label: "Last 1 Hour" },
  { value: "6h", label: "Last 6 Hours" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
];

interface TimeframeSelectorProps {
  value: TimeframeValue;
  onChange: (value: TimeframeValue) => void;
  className?: string;
}

export function TimeframeSelector({ value, onChange, className }: TimeframeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={value} onValueChange={(v) => onChange(v as TimeframeValue)}>
        <SelectTrigger aria-label="Select timeframe" className="h-9 text-sm border-border bg-card w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function getTimeframeLabel(value: TimeframeValue): string {
  return OPTIONS.find((o) => o.value === value)?.label ?? value;
}

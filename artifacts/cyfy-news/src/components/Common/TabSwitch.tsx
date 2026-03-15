import { cn } from "@/lib/utils";

export type TabValue = "local" | "global";

interface TabSwitchProps {
  value: TabValue;
  onChange: (value: TabValue) => void;
  className?: string;
  /** Show "(India)" label for Local button */
  showIndiaLabel?: boolean;
}

export function TabSwitch({ value, onChange, className, showIndiaLabel }: TabSwitchProps) {
  return (
    <div
      className={cn(
        "inline-flex p-1 rounded-full border border-primary bg-secondary/50",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange("local")}
        className={cn(
          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
          value === "local"
            ? "bg-primary text-white shadow-md"
            : "bg-transparent text-muted-foreground hover:text-foreground border border-transparent hover:border-primary/30"
        )}
      >
        Local{showIndiaLabel ? " (India)" : ""}
      </button>
      <button
        type="button"
        onClick={() => onChange("global")}
        className={cn(
          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
          value === "global"
            ? "bg-primary text-white shadow-md"
            : "bg-transparent text-muted-foreground hover:text-foreground border border-transparent hover:border-primary/30"
        )}
      >
        Global
      </button>
    </div>
  );
}

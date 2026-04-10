import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils";

interface StatusStripProps {
  isConnected: boolean;
  isRefreshing: boolean;
  lastUpdate: string | null;
  criticalCount: number;
  highCount: number;
  totalThreats: number;
  className?: string;
}

export function StatusStrip({
  isConnected,
  isRefreshing,
  lastUpdate,
  criticalCount,
  highCount,
  totalThreats,
  className,
}: StatusStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 flex-wrap text-[11px] font-mono",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Feed status"
    >
      {/* Connection status */}
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
          isConnected
            ? "bg-success/10 border-success/25 text-success"
            : "bg-destructive/10 border-destructive/25 text-destructive"
        )}
      >
        {isConnected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        {isConnected ? "LIVE" : "OFFLINE"}
      </span>

      {/* Refresh indicator */}
      {isRefreshing && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
          <RefreshCw className="h-3 w-3 animate-spin" />
          REFRESHING
        </span>
      )}

      <span className="text-border/60">|</span>

      {/* Severity counts */}
      {criticalCount > 0 && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          {criticalCount} CRIT
        </span>
      )}
      {highCount > 0 && (
        <span className="inline-flex items-center gap-1 text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {highCount} HIGH
        </span>
      )}
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
        {totalThreats} TOTAL
      </span>

      {lastUpdate && (
        <>
          <span className="text-border/60">|</span>
          <span className="text-muted-foreground">
            UPDATED {formatRelative(lastUpdate).toUpperCase()}
          </span>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { formatRelative } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
// Primary: event-driven via cyfy:refresh-complete / cyfy:stats-update
// Fallback: 5-min heartbeat so the status stays fresh even when WebSocket is idle
const STATUS_POLL_INTERVAL_MS = 5 * 60_000;

interface SchedulerStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextUpdate: string | null;
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastError: string | null;
  };
}

export function FeedStatus() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchStatus() {
      try {
        const res = await fetch(`${API_BASE}/scheduler/status`);
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as SchedulerStatus;
        if (active) { setStatus(data); setError(false); }
      } catch {
        if (active) setError(true);
      }
    }

    const handleRefreshEvent = () => {
      void fetchStatus();
    };

    fetchStatus();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchStatus();
      }
    }, STATUS_POLL_INTERVAL_MS);
    window.addEventListener("cyfy:refresh-complete", handleRefreshEvent);
    window.addEventListener("cyfy:stats-update", handleRefreshEvent);

    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("cyfy:refresh-complete", handleRefreshEvent);
      window.removeEventListener("cyfy:stats-update", handleRefreshEvent);
    };
  }, []);

  if (error || !status) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/20 text-xs text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        <span>Feed status unavailable</span>
      </div>
    );
  }

  const completedRuns = status.stats.successfulRuns + status.stats.failedRuns;
  const hasPendingRun = status.isRunning && status.stats.totalRuns > completedRuns;
  const successRate = completedRuns > 0
    ? Math.round((status.stats.successfulRuns / completedRuns) * 100)
    : status.stats.lastError
      ? 0
      : 100;
  const healthy = successRate >= 80 && !status.stats.lastError;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
        healthy ? "border-success/30 bg-success/10" : "border-accent/30 bg-accent/10"
      }`}>
        {healthy ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-accent" />
        )}
        <span className={healthy ? "text-success" : "text-accent"}>
          Feeds {successRate}%
        </span>
      </div>
      {hasPendingRun && (
        <span className="flex items-center gap-1 text-sky-300">
          <Activity className="h-3 w-3 animate-pulse" />
          Syncing
        </span>
      )}
      <span className="flex items-center gap-1">
        <Activity className="h-3 w-3" />
        {status.stats.totalRuns} runs
      </span>
      {status.lastRun && (
        <span>Last: {formatRelative(status.lastRun)}</span>
      )}
      {status.stats.lastError && (
        <span className="text-destructive truncate max-w-[200px]" title={status.stats.lastError}>
          {status.stats.lastError}
        </span>
      )}
    </div>
  );
}

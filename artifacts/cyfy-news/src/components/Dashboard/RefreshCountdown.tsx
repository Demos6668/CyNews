import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

interface RefreshCountdownProps {
  nextUpdate: string | null;
  isRefreshing: boolean;
}

export function RefreshCountdown({ nextUpdate, isRefreshing }: RefreshCountdownProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (!nextUpdate || isRefreshing) {
      setTimeLeft(isRefreshing ? "Refreshing..." : "");
      return;
    }
    const update = () => {
      const now = Date.now();
      const next = new Date(nextUpdate).getTime();
      const diff = next - now;
      if (diff <= 0) {
        setTimeLeft("Soon...");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextUpdate, isRefreshing]);

  const triggerRefresh = useCallback(async () => {
    if (triggering || isRefreshing) return;
    setTriggering(true);
    try {
      await fetch(`${API_BASE}/scheduler/refresh`, { method: "POST" });
    } catch {
      // WebSocket will reflect actual status
    } finally {
      setTriggering(false);
    }
  }, [triggering, isRefreshing]);

  const spinning = isRefreshing || triggering;

  return (
    <button
      type="button"
      onClick={triggerRefresh}
      disabled={spinning}
      title={spinning ? "Refreshing feeds..." : "Click to refresh feeds now"}
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground transition-colors",
        !spinning && "hover:text-primary cursor-pointer",
        spinning && "cursor-not-allowed",
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", spinning && "animate-spin text-accent")} />
      <span>
        {spinning ? "Refreshing..." : timeLeft ? `Next: ${timeLeft}` : "Refresh"}
      </span>
    </button>
  );
}

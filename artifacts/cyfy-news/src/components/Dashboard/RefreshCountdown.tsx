import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

interface RefreshCountdownProps {
  nextUpdate: string | null;
  isRefreshing: boolean;
}

export function RefreshCountdown({ nextUpdate, isRefreshing }: RefreshCountdownProps) {
  const [timeLeft, setTimeLeft] = useState("");

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

  if (isRefreshing) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
        <span>Refreshing...</span>
      </div>
    );
  }
  if (!timeLeft) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw className="h-3.5 w-3.5" />
      <span>Next: {timeLeft}</span>
    </div>
  );
}

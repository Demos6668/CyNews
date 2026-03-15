import { formatDate, stripHtml } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import type { ThreatIntelItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface ThreatTimelineProps {
  items: ThreatIntelItem[];
  onItemClick?: (item: ThreatIntelItem) => void;
  className?: string;
}

export function ThreatTimeline({
  items,
  onItemClick,
  className,
}: ThreatTimelineProps) {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-0">
        {sorted.map((item) => (
          <div
            key={item.id}
            className={cn(
              "relative pl-12 py-4 border-b border-border/50 last:border-0",
              onItemClick && "cursor-pointer hover:bg-white/5 transition-colors"
            )}
            onClick={() => onItemClick?.(item)}
          >
            <div
              className={cn(
                "absolute left-2 top-6 w-4 h-4 rounded-full border-2 border-background",
                item.severity === "critical" && "bg-destructive",
                item.severity === "high" && "bg-accent",
                item.severity === "medium" && "bg-warning",
                item.severity === "low" && "bg-success",
                item.severity === "info" && "bg-primary"
              )}
            />
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <SeverityBadge severity={item.severity} />
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatDate(item.publishedAt)}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground mb-1 line-clamp-2">
                  {item.title}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {stripHtml(item.summary ?? "")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

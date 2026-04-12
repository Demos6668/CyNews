import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/shared";
import { formatRelative } from "@/lib/utils";
import { getSeverityToken } from "@/lib/design-tokens";
import type { ActivityItem } from "@workspace/api-client-react";

interface ActivityStreamProps {
  items: ActivityItem[];
  /** Initial number of items to show; user can expand to see all. Default 8. */
  initialLimit?: number;
}

export function ActivityStream({ items, initialLimit = 8 }: ActivityStreamProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialLimit);
  const hasMore = items.length > initialLimit;

  return (
    <Card className="glass-panel">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-bold">Recent Activity Stream</h3>
        <span className="text-xs text-muted-foreground">
          {items.length} event{items.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-0">
        <div className="divide-y divide-border/50">
          {visible.map((activity) => {
            const dot = getSeverityToken(activity.severity).hex;
            const glowColor = getSeverityToken(activity.severity).fg
              .replace("text-", ""); // e.g. "destructive"

            return (
              <div
                key={activity.id}
                role={activity.sourceUrl ? "button" : undefined}
                tabIndex={activity.sourceUrl ? 0 : undefined}
                title={activity.sourceUrl ? "Open source" : undefined}
                onClick={() =>
                  activity.sourceUrl &&
                  window.open(activity.sourceUrl, "_blank", "noopener,noreferrer")
                }
                onKeyDown={(e) => {
                  if (
                    activity.sourceUrl &&
                    (e.key === "Enter" || e.key === " ")
                  ) {
                    e.preventDefault();
                    window.open(
                      activity.sourceUrl,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }
                }}
                className={`p-4 transition-colors flex items-center gap-4 ${
                  activity.sourceUrl
                    ? "cursor-pointer hover:bg-white/5"
                    : "cursor-default opacity-80"
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: dot,
                    boxShadow:
                      activity.severity === "critical" ||
                      activity.severity === "high"
                        ? `0 0 8px hsl(var(--${glowColor}))`
                        : undefined,
                  }}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {activity.type.toUpperCase()}
                    <span className="font-semibold capitalize" style={{ color: dot }}>
                      {activity.severity}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {formatRelative(activity.timestamp)}
                  </span>
                  {activity.sourceUrl && (
                    <ExternalLink
                      className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
                      aria-hidden
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 border-t border-border/50"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show {items.length - initialLimit} more
              </>
            )}
          </button>
        )}
      </div>
    </Card>
  );
}

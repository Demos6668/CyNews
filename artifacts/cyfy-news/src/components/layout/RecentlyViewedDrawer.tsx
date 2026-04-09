import { History, X, Trash2, FileText, Shield, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getSeverityToken } from "@/lib/design-tokens";
import type { RecentItem, RecentItemType } from "@/lib/recentlyViewed";

interface RecentlyViewedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecentItem[];
  onSelect: (item: RecentItem) => void;
  onRemove: (id: number, type: RecentItemType) => void;
  onClear: () => void;
}

const TYPE_ICON: Record<RecentItemType, React.ElementType> = {
  advisory: Shield,
  threat: FileText,
  news: Newspaper,
};

const TYPE_LABEL: Record<RecentItemType, string> = {
  advisory: "Advisory",
  threat: "Threat Intel",
  news: "News",
};

export function RecentlyViewedDrawer({
  isOpen,
  onClose,
  items,
  onSelect,
  onRemove,
  onClear,
}: RecentlyViewedDrawerProps) {
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Recently viewed"
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border/50 shadow-2xl overflow-hidden flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Recently Viewed</h2>
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                onClick={onClear}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                title="Clear all"
                aria-label="Clear all recently viewed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/60 p-8">
              <History className="h-10 w-10" />
              <p className="text-sm text-center">
                Items you open will appear here for quick access.
              </p>
            </div>
          ) : (
            <ul className="p-2 space-y-1">
              {items.map((item) => {
                const Icon = TYPE_ICON[item.type];
                const severityDot = item.severity
                  ? getSeverityToken(item.severity).hex
                  : undefined;

                return (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group flex items-start gap-3"
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                    >
                      <div className="mt-0.5 shrink-0 relative">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        {severityDot && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
                            style={{ backgroundColor: severityDot }}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="text-muted-foreground/60">{TYPE_LABEL[item.type]}</span>
                          {" · "}
                          {formatRelative(item.visitedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.id, item.type);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all rounded shrink-0 mt-0.5"
                        aria-label={`Remove ${item.title} from history`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

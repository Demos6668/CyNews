import { useEffect } from "react";
import { Calendar, ExternalLink, Target } from "lucide-react";
import { Badge, Button } from "@/components/ui/shared";
import { formatDate, stripHtml } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import type { NewsItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getSeverityToken } from "@/lib/design-tokens";
import { addRecentItem } from "@/lib/recentlyViewed";

interface NewsDetailProps {
  item: NewsItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NewsDetail({ item, isOpen, onClose }: NewsDetailProps) {
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen && item) {
      addRecentItem({ id: item.id, type: "news", title: item.title, severity: item.severity });
      window.dispatchEvent(new Event("cyfy:history-updated"));
    }
  }, [isOpen, item?.id]);

  if (!item) return null;

  const severityBg = getSeverityToken(item.severity).hex;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border/50 shadow-2xl overflow-y-auto custom-scrollbar transition-transform duration-500 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div
          className="h-2 w-full"
          style={{ backgroundColor: severityBg }}
        />

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <SeverityBadge severity={item.severity} />
              <Badge variant="outline">{item.category}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              ✕
            </Button>
          </div>

          <h2 className="text-3xl font-bold mb-4 font-sans leading-tight">
            {item.title}
          </h2>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 border-b border-white/10 pb-6 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {formatDate(item.publishedAt)}
            </span>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View Original Source ({item.source})
              </a>
            ) : (
              <span className="flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4" /> {item.source}
              </span>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                Summary
              </h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {stripHtml(item.summary ?? "")}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                Full Report
              </h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {stripHtml(item.content ?? "")}
              </p>
            </div>

            {item.iocs && item.iocs.length > 0 && (
              <div className="bg-background rounded-xl border border-destructive/20 p-5">
                <h3 className="text-sm font-mono text-destructive mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Target className="h-4 w-4" /> Indicators of Compromise (IOCs)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.iocs.map((ioc) => (
                    <code
                      key={ioc}
                      className="text-xs bg-destructive/10 text-destructive-foreground px-2 py-1 rounded select-all border border-destructive/20"
                    >
                      {ioc}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

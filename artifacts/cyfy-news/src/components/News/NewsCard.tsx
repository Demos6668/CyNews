import { Bookmark, Calendar, ExternalLink } from "lucide-react";
import { IndiaBadge } from "@/components/Threats";
import { Card, Badge } from "@/components/ui/shared";
import { cn, formatRelative, stripHtml } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import type { NewsItem } from "@workspace/api-client-react";
import { useToggleBookmark } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface NewsCardProps {
  item: NewsItem;
  onClick?: () => void;
}

export function NewsCard({ item, onClick }: NewsCardProps) {
  const queryClient = useQueryClient();
  const toggleBookmarkMutation = useToggleBookmark({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      },
    },
  });

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmarkMutation.mutate({ id: item.id });
  };

  const severityBorderClass = `severity-${item.severity}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card
        onClick={onClick}
        className={cn(
          "h-full overflow-hidden flex flex-col cursor-pointer card-spec group",
          "bg-[var(--background-card)] border border-[rgba(0,149,175,0.2)] rounded-xl",
          severityBorderClass
        )}
      >
        <div className="p-5 flex flex-col h-full bg-gradient-to-br from-transparent to-background/50">
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex flex-wrap gap-2">
              <SeverityBadge severity={item.severity} />
              <Badge
                variant="outline"
                className="border-white/10 text-muted-foreground bg-background/50"
              >
                {item.category}
              </Badge>
              {item.scope === "local" && (
                <Badge
                  variant="secondary"
                  className="bg-orange-500/20 text-orange-400"
                >
                  LOCAL
                </Badge>
              )}
            </div>
            {item.scope === "local" && (
              <div className="mb-2">
                <IndiaBadge item={item} />
              </div>
            )}
            <button
              onClick={handleBookmark}
              disabled={toggleBookmarkMutation.isPending}
              className="text-muted-foreground hover:text-accent transition-colors p-1 rounded-full hover:bg-white/5"
            >
              <Bookmark
                className={cn("h-5 w-5", item.bookmarked && "fill-accent text-accent")}
              />
            </button>
          </div>

          <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
          </h3>

          <p className="text-muted-foreground text-sm flex-grow line-clamp-3 mb-4">
            {stripHtml(item.summary ?? "")}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatRelative(item.publishedAt)}</span>
            </div>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-[10px] opacity-70 bg-background px-2 py-0.5 rounded hover:text-primary hover:opacity-100 flex items-center gap-1 transition-colors"
              >
                {item.source}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono text-[10px] opacity-70 bg-background px-2 py-0.5 rounded">
                {item.source}
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

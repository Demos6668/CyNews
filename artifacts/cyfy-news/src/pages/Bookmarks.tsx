import { useState } from "react";
import { useGetBookmarkedNews } from "@workspace/api-client-react";
import type { NewsItem } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/shared";
import { Bookmark, AlertTriangle } from "lucide-react";
import { NewsCard, NewsDetail } from "@/components/News";
import { PageHeader } from "@/components/Common";

export default function Bookmarks() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);

  const { data, isLoading, isError, error } = useGetBookmarkedNews();

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        icon={Bookmark}
        title="Bookmarks"
        meta={isLoading ? undefined : `${items.length} saved article${items.length !== 1 ? "s" : ""}`}
      />

      {isError ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Failed to load bookmarks</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
          <Bookmark className="h-16 w-16 text-muted-foreground opacity-30" />
          <h2 className="text-xl font-semibold text-muted-foreground">No bookmarks yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Click the bookmark icon on any news article to save it here for later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      <NewsDetail
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

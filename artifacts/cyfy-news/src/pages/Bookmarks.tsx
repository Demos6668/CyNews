import { useState, useMemo } from "react";
import { useGetBookmarkedNews } from "@workspace/api-client-react";
import type { NewsItem } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/shared";
import { Bookmark, AlertTriangle } from "lucide-react";
import { NewsCard, NewsDetail } from "@/components/News";
import { PageHeader } from "@/components/Common";
import { cn } from "@/lib/utils";

type ScopeFilter = "all" | "local" | "global";
type SortOrder = "newest" | "oldest";

export default function Bookmarks() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const { data, isLoading, isError, error } = useGetBookmarkedNews();

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (scope !== "all") list = list.filter((i) => i.scope === scope);
    if (sort === "newest") list = [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    else list = [...list].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    return list;
  }, [data?.items, scope, sort]);

  const total = data?.items?.length ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        icon={Bookmark}
        title="Bookmarks"
        meta={isLoading ? undefined : `${total} saved article${total !== 1 ? "s" : ""}`}
        actions={
          !isLoading && total > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Scope filter */}
              <div className="flex p-1 rounded-lg border border-border bg-secondary/50 gap-0.5">
                {(["all", "local", "global"] as ScopeFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize",
                      scope === s ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="text-xs rounded-md border border-border bg-secondary px-2 py-2 text-foreground"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          ) : undefined
        }
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
          <h2 className="text-xl font-semibold text-muted-foreground">
            {total === 0 ? "No bookmarks yet" : "No results for this filter"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {total === 0
              ? "Click the bookmark icon on any news article to save it here for later."
              : "Try changing the scope filter."}
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

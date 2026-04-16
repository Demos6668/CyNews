import { useState, useMemo } from "react";
import { useGetBookmarkedNews } from "@workspace/api-client-react";
import type { NewsItem } from "@workspace/api-client-react";
import { Skeleton, Button } from "@/components/ui/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bookmark, Newspaper, Shield } from "lucide-react";
import { NewsCard, NewsDetail } from "@/components/News";
import { PageHeader, ErrorState } from "@/components/Common";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Link } from "wouter";

type ScopeFilter = "all" | "local" | "global";
type SortOrder = "newest" | "oldest";

export default function Bookmarks() {
  usePageTitle("Bookmarks");
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const { data, isLoading, isError, error, refetch } = useGetBookmarkedNews();

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (scope !== "all") list = list.filter((i) => i.scope === scope);
    if (sort === "newest") list = [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    else list = [...list].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    return list;
  }, [data?.items, scope, sort]);

  const total = data?.items?.length ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
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
              <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
                <SelectTrigger className="text-xs h-8 w-32 border-border bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : undefined
        }
      />

      {isError ? (
        <ErrorState
          title="Failed to load bookmarks"
          message={error instanceof Error ? error.message : "An unexpected error occurred."}
          onRetry={() => void refetch()}
        />
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
          {total === 0 && (
            <div className="flex items-center gap-3 mt-2">
              <Link href="/news/local">
                <Button variant="outline" className="gap-2">
                  <Newspaper className="h-4 w-4" />
                  Browse Local News
                </Button>
              </Link>
              <Link href="/advisories">
                <Button variant="outline" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Browse Advisories
                </Button>
              </Link>
            </div>
          )}
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

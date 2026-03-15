import { useGetNews } from "@workspace/api-client-react";
import { NewsList, NewsFilter, NewsDetail } from "@/components/News";
import { TabSwitch, TimeframeSelector, type TimeframeValue } from "@/components/Common";
import { Skeleton } from "@/components/ui/shared";
import { EmptyState } from "@/components/Common";
import { useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, FileQuestion } from "lucide-react";
import type { NewsItem, GetNewsScope } from "@workspace/api-client-react";
import type { Severity } from "@/components/Common/SeverityBadge";

export default function NewsPage({ scope }: { scope: GetNewsScope }) {
  const [, setLocation] = useLocation();
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | undefined>(
    undefined
  );
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    undefined
  );
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, error } = useGetNews({
    scope,
    severity: severityFilter,
    category: categoryFilter,
    from: dateFrom,
    to: dateTo,
    timeframe: dateFrom || dateTo ? undefined : timeframe,
    limit: 20,
  });

  const hasActiveFilters = severityFilter || categoryFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setSeverityFilter(undefined);
    setCategoryFilter(undefined);
    setDateFrom(undefined);
    setDateTo(undefined);
    setShowFilters(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight capitalize">
            {scope} News & Threats
          </h1>
          <p className="text-muted-foreground mt-1">
            Latest cybersecurity intelligence and events.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <TabSwitch
            value={scope}
            onChange={(v) => setLocation(`/news/${v}`)}
            showIndiaLabel
          />
        </div>
      </div>

      <NewsFilter
        severity={severityFilter}
        category={categoryFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        showFilters={showFilters}
        onSeverityChange={setSeverityFilter}
        onCategoryChange={setCategoryFilter}
        onDateRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
        onShowFiltersToggle={() => setShowFilters(!showFilters)}
        onClearFilters={clearFilters}
      />

      {isError ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Failed to load news
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred. Please try again later."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : (data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No news items found"
          description={
            hasActiveFilters
              ? "No items match the selected filters. Try adjusting your filters."
              : undefined
          }
          action={
            hasActiveFilters
              ? { label: "Clear filters", onClick: clearFilters }
              : undefined
          }
        />
      ) : (
        <NewsList
          items={data?.items ?? []}
          onItemClick={(item) => setSelectedItem(item)}
        />
      )}

      <NewsDetail
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

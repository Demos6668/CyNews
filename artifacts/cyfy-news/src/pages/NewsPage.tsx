import { useGetNews } from "@workspace/api-client-react";
import { NewsList, NewsDetail } from "@/components/News";
import { TabSwitch, TimeframeSelector, FilterSection, type TimeframeValue } from "@/components/Common";
import { Skeleton } from "@/components/ui/shared";
import { EmptyState } from "@/components/Common";
import { useState, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle, FileQuestion } from "lucide-react";
import type { NewsItem, GetNewsScope } from "@workspace/api-client-react";
import { useFilterParamsSync, getInitialFiltersFromUrl } from "@/hooks/useFilterParams";

const NEWS_CATEGORY_OPTIONS = [
  "Ransomware",
  "Vulnerability",
  "Zero-Day",
  "Phishing",
  "APT Activity",
  "Data Breach",
  "Infrastructure Threat",
  "Malware",
  "CERT Advisory",
  "Supply Chain",
  "Compliance",
  "IoT Vulnerability",
  "Disinformation",
];

export default function NewsPage({ scope }: { scope: GetNewsScope }) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [severities, setSeverities] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const initial = getInitialFiltersFromUrl(searchString);
    if (initial.severities.length || initial.categories.length || initial.dateFrom || initial.dateTo) {
      setSeverities(initial.severities);
      setCategories(initial.categories);
      setDateFrom(initial.dateFrom);
      setDateTo(initial.dateTo);
      if (initial.timeframe) setTimeframe(initial.timeframe as TimeframeValue);
    }
  }, [searchString]);

  useFilterParamsSync(
    `/news/${scope}`,
    {
    severities,
    categories,
    dateFrom,
    dateTo,
    timeframe,
  },
    { skipInitialSync: true }
  );

  const toggleSeverity = useCallback((value: string) => {
    setSeverities((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }, []);

  const toggleCategory = useCallback((value: string) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }, []);

  const { data, isLoading, isError, error } = useGetNews({
    scope,
    severity: severities.length > 0 ? severities.join(",") : undefined,
    category: categories.length > 0 ? categories.join(",") : undefined,
    from: dateFrom,
    to: dateTo,
    timeframe: dateFrom || dateTo ? undefined : timeframe,
    limit: 20,
  });

  const activeFilterCount =
    severities.length + categories.length + (dateFrom || dateTo ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = useCallback(() => {
    setSeverities([]);
    setCategories([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setShowFilters(false);
  }, []);

  const applyPreset = useCallback((filters: { severities: string[]; categories: string[] }) => {
    setSeverities(filters.severities);
    setCategories(filters.categories);
  }, []);

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

      <FilterSection
        variant="news"
        severities={severities}
        categories={categories}
        categoryOptions={NEWS_CATEGORY_OPTIONS}
        onToggleSeverity={toggleSeverity}
        onToggleCategory={toggleCategory}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
        onApplyPreset={applyPreset}
        onClearAll={clearFilters}
        showFilters={showFilters}
        onShowFiltersToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
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

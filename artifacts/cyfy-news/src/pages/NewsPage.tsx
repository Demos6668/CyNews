import { useGetNews } from "@workspace/api-client-react";
import { NewsList, NewsDetail } from "@/components/News";
import { TabSwitch, TimeframeSelector, FilterSection, Pagination, EmptyState, ActiveFilterBar, type TimeframeValue, type ActiveFilter } from "@/components/Common";
import { Skeleton } from "@/components/ui/shared";
import { useState, useCallback, useEffect, useRef } from "react";
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

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function NewsPage({ scope }: { scope: GetNewsScope }) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [severities, setSeverities] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("7d");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Hydrate filter state from URL once on mount only.
  // Using a ref guard prevents re-running when useFilterParamsSync writes back to the URL,
  // which would otherwise cause an extra render cycle.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const initial = getInitialFiltersFromUrl(searchString);
    if (
      initial.severities.length ||
      initial.categories.length ||
      initial.dateFrom ||
      initial.dateTo ||
      initial.timeframe ||
      initial.page ||
      initial.limit
    ) {
      setSeverities(initial.severities);
      setCategories(initial.categories);
      setDateFrom(initial.dateFrom);
      setDateTo(initial.dateTo);
      if (initial.timeframe) setTimeframe(initial.timeframe as TimeframeValue);
      if (initial.page) setPage(initial.page);
      if (initial.limit) setLimit(initial.limit);
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
      page,
      limit,
    },
    { skipInitialSync: true }
  );

  const skipPageResetRef = useRef(true);
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [severities.join(","), categories.join(","), dateFrom, dateTo, timeframe]);

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
    page,
    limit,
  });

  // Auto-open detail when navigated from Search or Recently Viewed (?open=ID).
  // Falls back to a direct fetch if the item isn't in the current page.
  useEffect(() => {
    const openId = new URLSearchParams(searchString).get("open");
    if (!openId) return;
    const id = parseInt(openId, 10);
    if (isNaN(id)) return;
    const inPage = data?.items?.find((n) => n.id === id);
    if (inPage) { setSelectedItem(inPage); return; }
    fetch(`${API_BASE}/news/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((item: NewsItem | null) => { if (item) setSelectedItem(item); })
      .catch(() => undefined);
  }, [data?.items, searchString]);

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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleItemsPerPageChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const totalPages = data?.totalPages ?? 0;
  const totalItems = data?.total ?? 0;

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

      {hasActiveFilters && (
        <ActiveFilterBar
          filters={[
            ...severities.map((s): ActiveFilter => ({ key: `sev-${s}`, label: s.toUpperCase(), color: "severity", onRemove: () => toggleSeverity(s) })),
            ...categories.map((c): ActiveFilter => ({ key: `cat-${c}`, label: c, color: "category", onRemove: () => toggleCategory(c) })),
            ...(dateFrom ? [{ key: "dateFrom", label: `From ${dateFrom}`, color: "status" as const, onRemove: () => setDateFrom(undefined) }] : []),
            ...(dateTo ? [{ key: "dateTo", label: `To ${dateTo}`, color: "status" as const, onRemove: () => setDateTo(undefined) }] : []),
          ]}
          onClearAll={clearFilters}
        />
      )}

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
        <>
          <NewsList
            items={data?.items ?? []}
            onItemClick={(item) => setSelectedItem(item)}
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={limit}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </>
      )}

      <NewsDetail
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

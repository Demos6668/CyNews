import { useGetThreats } from "@workspace/api-client-react";
import { Skeleton, Button, Card, CardContent } from "@/components/ui/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabSwitch, TimeframeSelector, FilterSection, Pagination, EmptyState, ActiveFilterBar, ErrorState, type TimeframeValue, type ActiveFilter } from "@/components/Common";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Crosshair,
  Download,
  Terminal,
  Network,
  List,
  LayoutGrid,
  Layers,
} from "lucide-react";
import type { ThreatIntelItem } from "@workspace/api-client-react";
import { ThreatCard, ThreatModal, ThreatTimeline, ThreatGroupView } from "@/components/Threats";
import { useFilterParamsSync, getInitialFiltersFromUrl } from "@/hooks/useFilterParams";
import { usePageTitle } from "@/hooks/usePageTitle";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

interface GroupedResponse {
  groups: { key: string; count: number; items: ThreatIntelItem[] }[];
  total: number;
  groupBy: string;
}

const THREAT_CATEGORY_OPTIONS = [
  "Ransomware",
  "Vulnerability Exploitation",
  "Zero-Day",
  "Phishing Campaign",
  "APT Activity",
  "ICS/OT Threat",
  "Malware",
  "Financial Threat",
  "IoT Vulnerability",
];

export default function ThreatIntel() {
  usePageTitle("Threat Intelligence");
  const searchString = useSearch();
  const [pathname, setLocation] = useLocation();
  const [selectedItem, setSelectedItem] = useState<ThreatIntelItem | null>(null);
  const [severities, setSeverities] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("7d");
  const [scope, setScope] = useState<"local" | "global">("global");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Hydrate filter state from URL once on mount only.
  // dep array is [] — we capture searchString at mount time intentionally.
  const hydratedRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const initial = getInitialFiltersFromUrl(searchString);
    if (
      initial.severities.length ||
      initial.categories.length ||
      initial.timeframe ||
      initial.scope ||
      initial.page ||
      initial.limit
    ) {
      setSeverities(initial.severities);
      setCategories(initial.categories);
      if (initial.timeframe) setTimeframe(initial.timeframe as TimeframeValue);
      if (initial.scope) setScope(initial.scope as "local" | "global");
      if (initial.page) setPage(initial.page);
      if (initial.limit) setLimit(initial.limit);
    }
  }, []);

  useFilterParamsSync(
    "/threat-intel",
    { severities, categories, timeframe, scope, page, limit },
    { skipInitialSync: true }
  );

  const skipPageResetRef = useRef(true);
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [severities.join(","), categories.join(","), timeframe, scope]);

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

  const { data, isLoading, isError, error, refetch } = useGetThreats({
    scope,
    severity: severities.length > 0 ? severities.join(",") : undefined,
    category: categories.length > 0 ? categories.join(",") : undefined,
    timeframe,
    page: groupBy ? undefined : page,
    limit: groupBy ? undefined : limit,
    ...(groupBy ? { groupBy } : {}),
  } as Parameters<typeof useGetThreats>[0]);

  // Grouped response shape (not in generated types, accessed via cast)
  const groupedData = groupBy ? (data as unknown as GroupedResponse | undefined) : undefined;

  // Auto-open detail when navigated from Search or Recently Viewed (?open=ID)
  useEffect(() => {
    const openId = new URLSearchParams(searchString).get("open");
    if (!openId) return;
    const id = parseInt(openId, 10);
    if (isNaN(id)) return;
    const inPage = data?.items?.find((t) => t.id === id);
    if (inPage) { setSelectedItem(inPage); return; }
    fetch(`${API_BASE}/threats/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((item: ThreatIntelItem | null) => { if (item) setSelectedItem(item); })
      .catch(() => undefined);
  }, [data?.items, searchString]);

  const activeFilterCount = severities.length + categories.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = useCallback(() => {
    setSeverities([]);
    setCategories([]);
    setShowFilters(false);
  }, []);

  const applyPreset = useCallback((filters: { severities: string[]; categories: string[] }) => {
    setSeverities(filters.severities);
    setCategories(filters.categories);
  }, []);

  const handleExport = (format: "csv" | "json") => {
    const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
    const params = new URLSearchParams({ format });
    if (scope) params.set("scope", scope);
    if (timeframe) params.set("timeframe", timeframe);
    if (severities.length > 0) params.set("severity", severities.join(","));
    if (categories.length > 0) params.set("category", categories.join(","));
    window.open(`${apiBase}/threats/export?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

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

  const openThreat = (item: ThreatIntelItem) => {
    setSelectedItem(item);
    const params = new URLSearchParams(searchString);
    params.set("open", String(item.id));
    setLocation(`${pathname}?${params.toString()}`);
  };

  const closeThreat = () => {
    setSelectedItem(null);
    const params = new URLSearchParams(searchString);
    params.delete("open");
    const qs = params.toString();
    setLocation(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3 glow-text">
            <Crosshair className="h-8 w-8 text-destructive" /> Threat Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">
            Deep dive into actor profiles, TTPs, and campaign tracking.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <TabSwitch value={scope} onChange={setScope} showIndiaLabel />
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="flex p-1 rounded-lg border border-border bg-secondary/50">
            <button
              type="button"
              onClick={() => { setViewMode("grid"); setGroupBy(undefined); }}
              className={`p-2 rounded ${viewMode === "grid" && !groupBy ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              title="Grid view"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              onClick={() => { setViewMode("timeline"); setGroupBy(undefined); }}
              className={`p-2 rounded ${viewMode === "timeline" && !groupBy ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              title="Timeline view"
            >
              <List size={18} />
            </button>
            <button
              type="button"
              onClick={() => setGroupBy(groupBy ? undefined : "category")}
              className={`p-2 rounded ${groupBy ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              title="Grouped view"
            >
              <Layers size={18} />
            </button>
          </div>
          {groupBy !== undefined && (
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="text-xs h-8 w-36 border-border bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">By Category</SelectItem>
                <SelectItem value="severity">By Severity</SelectItem>
                <SelectItem value="threat_actor">By Threat Actor</SelectItem>
                <SelectItem value="source">By Source</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleExport("csv")}
            >
              <Download size={16} /> CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleExport("json")}
            >
              <Download size={16} /> JSON
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-white/5 backdrop-blur">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Terminal className="text-primary h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Active Campaigns</h3>
              <p className="text-sm text-muted-foreground">
                Tracking{" "}
                {(data?.items ?? []).filter((i) => i.status === "active").length}{" "}
                active sophisticated threat campaigns.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5 backdrop-blur">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
              <Network className="text-accent h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Total Threats Tracked</h3>
              <p className="text-sm text-muted-foreground">
                {data?.total ?? 0} threat intelligence items catalogued across
                all regions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 space-y-2">
        <FilterSection
          variant="threats"
          severities={severities}
          categories={categories}
          categoryOptions={THREAT_CATEGORY_OPTIONS}
          onToggleSeverity={toggleSeverity}
          onToggleCategory={toggleCategory}
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
            ]}
            onClearAll={clearFilters}
          />
        )}
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4 border-l-4 border-primary pl-3">
        {groupBy ? "Grouped Threats" : "Latest Threat Reports"}
      </h2>

      {isError ? (
        <ErrorState
          title="Failed to load threat intelligence"
          message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again later."}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : groupBy ? (
        <ThreatGroupView
          groups={groupedData?.groups ?? []}
          total={groupedData?.total ?? 0}
          groupBy={groupBy}
          onItemClick={openThreat}
        />
      ) : (data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          title="No threat reports found"
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
      ) : viewMode === "timeline" ? (
        <>
          <div className="bg-card/50 rounded-xl border border-white/5 overflow-hidden">
            <ThreatTimeline
              items={data?.items ?? []}
              onItemClick={openThreat}
            />
          </div>
          {totalPages >= 1 && (
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
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(data?.items ?? []).map((item) => (
              <ThreatCard
                key={item.id}
                item={item}
                onClick={() => openThreat(item)}
              />
            ))}
          </div>
          {totalPages >= 1 && (
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

      <ThreatModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={closeThreat}
      />
    </div>
  );
}

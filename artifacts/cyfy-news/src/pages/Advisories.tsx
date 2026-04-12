import { useGetAdvisories } from "@workspace/api-client-react";
import { AdvisoryList, AdvisoryDetail } from "@/components/Advisories";
import { Skeleton, Button } from "@/components/ui/shared";
import { TabSwitch, TimeframeSelector, FilterSection, Pagination, ActiveFilterBar, type TimeframeValue, type ActiveFilter } from "@/components/Common";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { ShieldAlert, AlertTriangle, Download, ChevronDown, Mail, FileDown } from "lucide-react";
import type { Advisory } from "@workspace/api-client-react";
import { EmptyState } from "@/components/Common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkEmailExportModal } from "@/components/Export";
import { useFilterParamsSync, getInitialFiltersFromUrl } from "@/hooks/useFilterParams";
import { exportAdvisoriesBulk } from "@/lib/exportApi";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "New", value: "new" },
  { label: "Under Review", value: "under_review" },
  { label: "Patched", value: "patched" },
  { label: "Dismissed", value: "dismissed" },
];

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function Advisories() {
  const searchString = useSearch();
  const { data: vendorData } = useQuery<{ vendors: string[] }>({
    queryKey: ["advisories-vendors"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/advisories/vendors`); if (!r.ok) throw new Error("Failed to fetch vendors"); return r.json(); },
    staleTime: 5 * 60 * 1000,
  });
  const vendorOptions = vendorData?.vendors ?? [];
  const [selectedItem, setSelectedItem] = useState<Advisory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEmailExportOpen, setBulkEmailExportOpen] = useState(false);
  const [severities, setSeverities] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("7d");
  const [scope, setScope] = useState<"local" | "global">("global");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Hydrate filter state from URL once on mount only.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const initial = getInitialFiltersFromUrl(searchString);
    if (initial.severities.length) setSeverities(initial.severities);
    if (initial.statuses?.length) setStatuses(initial.statuses);
    if (initial.vendors?.length) setVendors(initial.vendors);
    if (initial.timeframe) setTimeframe(initial.timeframe as TimeframeValue);
    if (initial.scope) setScope(initial.scope as "local" | "global");
    if (initial.page) setPage(initial.page);
    if (initial.limit) setLimit(initial.limit);
  }, [searchString]);

  useFilterParamsSync(
    "/advisories",
    { severities, statuses, vendors, timeframe, scope, page, limit },
    { skipInitialSync: true }
  );

  const skipPageResetRef = useRef(true);
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [severities.join(","), statuses.join(","), vendors.join(","), timeframe, scope]);

  const toggleSeverity = useCallback((value: string) => {
    setSeverities((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }, []);

  const toggleStatus = useCallback((value: string) => {
    setStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }, []);

  const toggleVendor = useCallback((value: string) => {
    setVendors((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const { data, isLoading, isError, error } = useGetAdvisories({
    scope,
    severity: severities.length > 0 ? severities.join(",") : undefined,
    status: statuses.length > 0 ? statuses.join(",") : undefined,
    vendor: vendors.length > 0 ? vendors.join(",") : undefined,
    timeframe,
    page,
    limit,
    excludeCertIn: true,
  });

  // Auto-open detail when navigated from Search or Recently Viewed (?open=ID).
  // If the item isn't on the current page (e.g. deep link with timeframe=all
  // but item is buried), fall back to fetching it directly by ID.
  useEffect(() => {
    const openId = new URLSearchParams(searchString).get("open");
    if (!openId) return;
    const id = parseInt(openId, 10);
    if (isNaN(id)) return;

    const inPage = data?.items?.find((a) => a.id === id);
    if (inPage) { setSelectedItem(inPage); return; }

    // Not in current page — fetch directly
    fetch(`${API_BASE}/advisories/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((item: Advisory | null) => { if (item) setSelectedItem(item); })
      .catch(() => undefined);
  }, [data?.items, searchString]);

  const activeFilterCount = severities.length + statuses.length + vendors.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = useCallback(() => {
    setSeverities([]);
    setStatuses([]);
    setVendors([]);
    setShowFilters(false);
  }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const blob = await exportAdvisoriesBulk({ ids: Array.from(selectedIds) });
      if (!blob) { toast.error("Export failed"); return; }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cynews-advisories-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSelectedIds(new Set());
    } catch {
      toast.error("Export failed. Please try again.");
    }
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

  const handleExportAll = async () => {
    try {
      const blob = await exportAdvisoriesBulk({ timeframe, scope });
      if (!blob) { toast.error("Export failed"); return; }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cynews-advisories-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" /> Security Advisories
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage CVEs, patches, and vulnerabilities.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TabSwitch value={scope} onChange={setScope} showIndiaLabel />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={selectedIds.size === 0}
              >
                <Download className="h-4 w-4" />
                Export Selected ({selectedIds.size})
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleExportSelected}
                disabled={selectedIds.size === 0}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setBulkEmailExportOpen(true)}
                disabled={selectedIds.size === 0}
              >
                <Mail className="h-4 w-4 mr-2" />
                Export as Email
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleExportAll}>
            <Download className="h-4 w-4" />
            Export All ({timeframe})
          </Button>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      <FilterSection
        variant="advisories"
        severities={severities}
        statuses={statuses}
        statusOptions={STATUS_OPTIONS}
        vendors={vendors}
        vendorOptions={vendorOptions}
        onToggleSeverity={toggleSeverity}
        onToggleStatus={toggleStatus}
        onToggleVendor={toggleVendor}
        onClearAll={clearFilters}
        showFilters={showFilters}
        onShowFiltersToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
      />

      {hasActiveFilters && (
        <ActiveFilterBar
          filters={[
            ...severities.map((s): ActiveFilter => ({ key: `sev-${s}`, label: s.toUpperCase(), color: "severity", onRemove: () => toggleSeverity(s) })),
            ...statuses.map((s): ActiveFilter => ({ key: `status-${s}`, label: s.replace("_", " "), color: "status", onRemove: () => toggleStatus(s) })),
            ...vendors.map((v): ActiveFilter => ({ key: `vendor-${v}`, label: v, color: "vendor", onRemove: () => toggleVendor(v) })),
          ]}
          onClearAll={clearFilters}
        />
      )}

      {isError ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Failed to load advisories</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {error instanceof Error ? error.message : "An unexpected error occurred. Please try again later."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : (data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          title="No advisories found"
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
          <AdvisoryList
            items={data?.items ?? []}
            onItemClick={(item) => setSelectedItem(item)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            showCheckboxes
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

      <AdvisoryDetail
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <BulkEmailExportModal
        advisoryIds={Array.from(selectedIds)}
        isCertIn={false}
        isOpen={bulkEmailExportOpen}
        onClose={() => setBulkEmailExportOpen(false)}
      />
    </div>
  );
}

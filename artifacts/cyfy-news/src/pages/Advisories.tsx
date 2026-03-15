import { useGetAdvisories } from "@workspace/api-client-react";
import { AdvisoryList, AdvisoryDetail } from "@/components/Advisories";
import { Skeleton, Button } from "@/components/ui/shared";
import { TabSwitch, TimeframeSelector, type TimeframeValue } from "@/components/Common";
import { useState } from "react";
import { ShieldAlert, Filter, X, AlertTriangle, Download } from "lucide-react";
import type { Advisory, GetAdvisoriesSeverity, GetAdvisoriesStatus } from "@workspace/api-client-react";
import { EmptyState } from "@/components/Common";

const SEVERITY_OPTIONS: { label: string; value: GetAdvisoriesSeverity }[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "info" },
];

const STATUS_OPTIONS: { label: string; value: GetAdvisoriesStatus }[] = [
  { label: "New", value: "new" },
  { label: "Under Review", value: "under_review" },
  { label: "Patched", value: "patched" },
  { label: "Dismissed", value: "dismissed" },
];

const VENDOR_OPTIONS = [
  "Fortinet", "Apache", "Microsoft", "Linux", "VMware", "Cisco", "WordPress",
];

export default function Advisories() {
  const [selectedItem, setSelectedItem] = useState<Advisory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<GetAdvisoriesSeverity | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<GetAdvisoriesStatus | undefined>(undefined);
  const [vendorFilter, setVendorFilter] = useState<string | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const [scope, setScope] = useState<"local" | "global">("global");

  const { data, isLoading, isError, error } = useGetAdvisories({
    scope,
    severity: severityFilter,
    status: statusFilter,
    vendor: vendorFilter,
    timeframe,
    limit: 20,
  });

  const hasActiveFilters = severityFilter || statusFilter || vendorFilter;

  const clearFilters = () => {
    setSeverityFilter(undefined);
    setStatusFilter(undefined);
    setVendorFilter(undefined);
    setShowFilters(false);
  };

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
    const res = await fetch("/api/export/advisories/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cyfy-advisories-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
    setSelectedIds(new Set());
  };

  const handleExportAll = async () => {
    const res = await fetch("/api/export/advisories/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeframe, scope }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cyfy-advisories-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportSelected}
            disabled={selectedIds.size === 0}
          >
            <Download className="h-4 w-4" />
            Export Selected ({selectedIds.size})
          </Button>
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleExportAll}>
            <Download className="h-4 w-4" />
            Export All ({timeframe})
          </Button>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          className="gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {[severityFilter, statusFilter, vendorFilter].filter(Boolean).length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 bg-card/50 rounded-xl border border-white/5">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-16">Severity:</span>
            {SEVERITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={severityFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSeverityFilter(severityFilter === opt.value ? undefined : opt.value)}
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-16">Status:</span>
            {STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(statusFilter === opt.value ? undefined : opt.value)}
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-16">Vendor:</span>
            {VENDOR_OPTIONS.map((v) => (
              <Button
                key={v}
                variant={vendorFilter === v ? "default" : "outline"}
                size="sm"
                onClick={() => setVendorFilter(vendorFilter === v ? undefined : v)}
                className="text-xs"
              >
                {v}
              </Button>
            ))}
          </div>
        </div>
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
        <AdvisoryList
          items={data?.items ?? []}
          onItemClick={(item) => setSelectedItem(item)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          showCheckboxes
        />
      )}

      <AdvisoryDetail
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

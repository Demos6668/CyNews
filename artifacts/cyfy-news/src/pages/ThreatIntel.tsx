import { useGetThreats } from "@workspace/api-client-react";
import { Skeleton, Button, Card, CardContent } from "@/components/ui/shared";
import { TabSwitch, TimeframeSelector, type TimeframeValue } from "@/components/Common";
import { useState } from "react";
import {
  Crosshair,
  Download,
  Terminal,
  Network,
  Filter,
  X,
  AlertTriangle,
  List,
  LayoutGrid,
} from "lucide-react";
import type { ThreatIntelItem, GetThreatsSeverity } from "@workspace/api-client-react";
import { ThreatCard, ThreatModal, ThreatTimeline } from "@/components/Threats";
import { EmptyState } from "@/components/Common";

const SEVERITY_OPTIONS: { label: string; value: GetThreatsSeverity }[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "info" },
];

const CATEGORY_OPTIONS = [
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
  const [selectedItem, setSelectedItem] = useState<ThreatIntelItem | null>(null);
  const [severityFilter, setSeverityFilter] = useState<
    GetThreatsSeverity | undefined
  >(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    undefined
  );
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const [scope, setScope] = useState<"local" | "global">("global");

  const { data, isLoading, isError, error } = useGetThreats({
    scope,
    severity: severityFilter,
    category: categoryFilter,
    timeframe,
    limit: 50,
  });

  const hasActiveFilters = severityFilter || categoryFilter;

  const clearFilters = () => {
    setSeverityFilter(undefined);
    setCategoryFilter(undefined);
    setShowFilters(false);
  };

  const handleExport = (format: "csv" | "json") => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    window.open(`${baseUrl}api/threats/export?format=${format}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              title="Grid view"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`p-2 rounded ${viewMode === "timeline" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              title="Timeline view"
            >
              <List size={18} />
            </button>
          </div>
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

      <div className="flex items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          className="gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {[severityFilter, categoryFilter].filter(Boolean).length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={clearFilters}
          >
            <X size={14} /> Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 bg-card/50 rounded-xl border border-white/5">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-16">
              Severity:
            </span>
            {SEVERITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={severityFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setSeverityFilter(
                    severityFilter === opt.value ? undefined : opt.value
                  )
                }
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-16">
              Category:
            </span>
            {CATEGORY_OPTIONS.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat ? undefined : cat)
                }
                className="text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold mt-8 mb-4 border-l-4 border-primary pl-3">
        Latest Threat Reports
      </h2>

      {isError ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Failed to load threat intelligence
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred. Please try again later."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
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
        <div className="bg-card/50 rounded-xl border border-white/5 overflow-hidden">
          <ThreatTimeline
            items={data?.items ?? []}
            onItemClick={(item) => setSelectedItem(item)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(data?.items ?? []).map((item) => (
            <ThreatCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      <ThreatModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

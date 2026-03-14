import { useGetNews } from "@workspace/api-client-react";
import { NewsCard, DetailModal } from "@/components/shared/ItemCards";
import { Skeleton, Button } from "@/components/ui/shared";
import { useState } from "react";
import { useLocation } from "wouter";
import { Filter, X } from "lucide-react";
import type { NewsItem, GetNewsScope, GetNewsSeverity } from "@workspace/api-client-react";

const SEVERITY_OPTIONS: { label: string; value: GetNewsSeverity }[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "info" },
];

export default function NewsPage({ scope }: { scope: GetNewsScope }) {
  const [, setLocation] = useLocation();
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [severityFilter, setSeverityFilter] = useState<GetNewsSeverity | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useGetNews({
    scope,
    severity: severityFilter,
    limit: 20,
  });

  const clearFilters = () => {
    setSeverityFilter(undefined);
    setShowFilters(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight capitalize">{scope} News & Threats</h1>
          <p className="text-muted-foreground mt-1">Latest cybersecurity intelligence and events.</p>
        </div>

        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg border border-border">
          <Button
            variant={scope === 'local' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLocation('/news/local')}
            className="rounded-md w-24"
          >
            Local
          </Button>
          <Button
            variant={scope === 'global' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLocation('/news/global')}
            className="rounded-md w-24"
          >
            Global
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          className="gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filters
        </Button>
        {severityFilter && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 bg-card/50 rounded-xl border border-white/5">
          <span className="text-xs text-muted-foreground uppercase tracking-wider self-center mr-2">Severity:</span>
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
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No news items found{severityFilter ? ` with severity "${severityFilter}"` : ""}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data?.items.map(item => (
            <NewsCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
          ))}
        </div>
      )}

      <DetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

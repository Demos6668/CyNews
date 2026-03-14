import { useGetThreats } from "@workspace/api-client-react";
import { Skeleton, Button, Card, CardContent, Badge } from "@/components/ui/shared";
import { useState } from "react";
import { Crosshair, Download, Terminal, Network, Shield, Target, Calendar, ChevronDown, ChevronUp, ExternalLink, Filter, X, AlertTriangle } from "lucide-react";
import type { ThreatIntelItem, GetThreatsSeverity } from "@workspace/api-client-react";
import { cn, getSeverityBadgeColors, formatDate, formatRelative } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

function ThreatCard({ item, onClick }: { item: ThreatIntelItem; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card
        onClick={onClick}
        className={cn(
          "h-full overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-xl group",
          "border-border/50 bg-card/60 backdrop-blur-sm",
          item.severity === "critical" && "border-l-4 border-l-destructive",
          item.severity === "high" && "border-l-4 border-l-orange-500",
          item.severity === "medium" && "border-l-4 border-l-yellow-500",
          item.severity === "low" && "border-l-4 border-l-blue-400",
        )}
      >
        <div className="p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge className={getSeverityBadgeColors(item.severity)}>
                {item.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-muted-foreground bg-background/50">
                {item.category}
              </Badge>
              {item.confidenceLevel === "confirmed" && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400">CONFIRMED</Badge>
              )}
            </div>
          </div>

          {item.threatActor && (
            <div className="text-xs font-mono text-primary mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" /> {item.threatActor}
              {item.campaignName && <span className="text-muted-foreground ml-2">• {item.campaignName}</span>}
            </div>
          )}

          <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
          </h3>

          <p className="text-muted-foreground text-sm flex-grow line-clamp-3 mb-4">
            {item.summary}
          </p>

          {item.ttps.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.ttps.slice(0, 2).map((ttp: string) => (
                <span key={ttp} className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {ttp.split(" - ")[0]}
                </span>
              ))}
              {item.ttps.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{item.ttps.length - 2} more</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatRelative(item.publishedAt)}</span>
            </div>
            <span className="font-mono text-[10px] opacity-70 bg-background px-2 py-0.5 rounded">{item.source}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ThreatDetailPanel({ item, isOpen, onClose }: { item: ThreatIntelItem | null; isOpen: boolean; onClose: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ttps: true,
    iocs: true,
    mitigations: true,
  });

  if (!item) return null;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const AccordionSection = ({ title, sectionKey, children, icon: Icon, color }: { title: string; sectionKey: string; children: React.ReactNode; icon: React.ElementType; color: string }) => (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button
        onClick={() => toggleSection(sectionKey)}
        className={cn("w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left", color)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider">
          <Icon className="h-4 w-4" /> {title}
        </div>
        {expandedSections[sectionKey] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {expandedSections[sectionKey] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className={cn("fixed inset-0 z-50 transition-all duration-300", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border/50 shadow-2xl overflow-y-auto custom-scrollbar transition-transform duration-500 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className={cn(
          "h-2 w-full",
          item.severity === "critical" && "bg-destructive",
          item.severity === "high" && "bg-orange-500",
          item.severity === "medium" && "bg-yellow-500",
          item.severity === "low" && "bg-blue-400",
          item.severity === "info" && "bg-gray-400",
        )} />

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 flex-wrap">
              <Badge className={getSeverityBadgeColors(item.severity)}>{item.severity.toUpperCase()}</Badge>
              <Badge variant="outline">{item.category}</Badge>
              <Badge variant="outline" className="uppercase text-[10px]">{item.status}</Badge>
              <Badge variant="secondary" className="text-[10px]">{item.confidenceLevel}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
          </div>

          <h2 className="text-3xl font-bold mb-2 font-sans leading-tight">{item.title}</h2>

          {item.threatActor && (
            <div className="flex items-center gap-2 text-primary font-mono mb-4">
              <Shield className="h-5 w-5" />
              <span className="font-bold">{item.threatActor}</span>
              {item.threatActorAliases && item.threatActorAliases.length > 0 && (
                <span className="text-muted-foreground text-sm">
                  ({item.threatActorAliases.join(", ")})
                </span>
              )}
            </div>
          )}

          {item.campaignName && (
            <div className="text-sm text-accent mb-4 font-mono">Campaign: {item.campaignName}</div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 border-b border-white/10 pb-6 flex-wrap">
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {formatDate(item.publishedAt)}</span>
            <span className="flex items-center gap-1.5"><ExternalLink className="h-4 w-4" /> {item.source}</span>
            {item.firstSeen && <span className="text-xs">First seen: {formatDate(item.firstSeen)}</span>}
            {item.lastSeen && <span className="text-xs">Last seen: {formatDate(item.lastSeen)}</span>}
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {item.targetSectors.map((s: string) => (
                <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">{s}</span>
              ))}
            </div>
            {item.targetRegions.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Regions: {item.targetRegions.join(", ")}
              </div>
            )}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">Description</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>

          <div className="space-y-3">
            {item.ttps.length > 0 && (
              <AccordionSection title="TTPs (MITRE ATT&CK)" sectionKey="ttps" icon={Target} color="text-primary">
                <ul className="space-y-1.5">
                  {item.ttps.map((ttp: string) => (
                    <li key={ttp} className="text-sm font-mono bg-background/50 px-3 py-1.5 rounded text-muted-foreground border border-white/5">
                      {ttp}
                    </li>
                  ))}
                </ul>
              </AccordionSection>
            )}

            {item.iocs.length > 0 && (
              <AccordionSection title="Indicators of Compromise" sectionKey="iocs" icon={Crosshair} color="text-destructive">
                <div className="flex flex-wrap gap-2">
                  {item.iocs.map((ioc: string) => (
                    <code key={ioc} className="text-xs bg-destructive/10 text-destructive-foreground px-2 py-1 rounded select-all border border-destructive/20">
                      {ioc}
                    </code>
                  ))}
                </div>
              </AccordionSection>
            )}

            {item.malwareFamilies && item.malwareFamilies.length > 0 && (
              <AccordionSection title="Malware Families" sectionKey="malware" icon={Shield} color="text-orange-400">
                <div className="flex flex-wrap gap-2">
                  {item.malwareFamilies.map((m: string) => (
                    <Badge key={m} variant="outline" className="border-orange-400/30 text-orange-400">{m}</Badge>
                  ))}
                </div>
              </AccordionSection>
            )}

            {item.mitigations.length > 0 && (
              <AccordionSection title="Mitigations" sectionKey="mitigations" icon={Shield} color="text-green-400">
                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm">
                  {item.mitigations.map((m: string, i: number) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </AccordionSection>
            )}

            {item.affectedSystems.length > 0 && (
              <AccordionSection title="Affected Systems" sectionKey="systems" icon={Target} color="text-yellow-400">
                <div className="flex flex-wrap gap-2">
                  {item.affectedSystems.map((s: string) => (
                    <span key={s} className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded border border-yellow-500/20">{s}</span>
                  ))}
                </div>
              </AccordionSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreatIntel() {
  const [selectedItem, setSelectedItem] = useState<ThreatIntelItem | null>(null);
  const [severityFilter, setSeverityFilter] = useState<GetThreatsSeverity | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, error } = useGetThreats({
    severity: severityFilter,
    category: categoryFilter,
    limit: 20,
  });

  const hasActiveFilters = severityFilter || categoryFilter;

  const clearFilters = () => {
    setSeverityFilter(undefined);
    setCategoryFilter(undefined);
    setShowFilters(false);
  };

  const handleExportCSV = () => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    window.open(`${baseUrl}api/threats/export`, "_blank");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3 glow-text">
            <Crosshair className="h-8 w-8 text-destructive" /> Threat Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">Deep dive into actor profiles, TTPs, and campaign tracking.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </Button>
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
              <p className="text-sm text-muted-foreground">Tracking {data?.items.filter((i) => i.status === "active").length ?? 0} active sophisticated threat campaigns.</p>
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
              <p className="text-sm text-muted-foreground">{data?.total ?? 0} threat intelligence items catalogued across all regions.</p>
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
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 w-16">Category:</span>
            {CATEGORY_OPTIONS.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === cat ? undefined : cat)}
                className="text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold mt-8 mb-4 border-l-4 border-primary pl-3">Latest Threat Reports</h2>

      {isError ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Failed to load threat intelligence</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {error instanceof Error ? error.message : "An unexpected error occurred. Please try again later."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No threat reports found{hasActiveFilters ? " matching the selected filters" : ""}.</p>
          {hasActiveFilters && (
            <Button variant="link" className="mt-2 text-primary" onClick={clearFilters}>Clear filters</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.items.map(item => (
            <ThreatCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
          ))}
        </div>
      )}

      <ThreatDetailPanel
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

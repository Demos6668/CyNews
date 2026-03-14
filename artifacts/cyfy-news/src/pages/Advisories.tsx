import { useGetAdvisories } from "@workspace/api-client-react";
import { AdvisoryCard } from "@/components/shared/ItemCards";
import { Skeleton, Button, Badge } from "@/components/ui/shared";
import { useState } from "react";
import { ShieldAlert, Calendar, Target, ExternalLink, ChevronDown, ChevronUp, Shield, FileText } from "lucide-react";
import type { Advisory } from "@workspace/api-client-react";
import { cn, formatDate, getSeverityBadgeColors } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function AccordionSection({ title, sectionKey, expanded, onToggle, children, icon: Icon, color }: {
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={cn("w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left", color)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider">
          <Icon className="h-4 w-4" /> {title}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {expanded && (
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
}

function AdvisoryDetailPanel({ item, isOpen, onClose }: { item: Advisory | null; isOpen: boolean; onClose: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    workarounds: true,
    products: true,
    refs: false,
  });

  if (!item) return null;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
              <Badge variant="outline" className="uppercase text-[10px]">{item.status.replace('_', ' ')}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
          </div>

          <h2 className="text-3xl font-bold mb-4 font-sans leading-tight">{item.title}</h2>

          <div className="flex items-center gap-4 p-4 bg-background/50 rounded-xl border border-white/5 mb-6">
            <div className="text-center px-4 border-r border-white/10">
              <div className="text-3xl font-mono font-bold text-white">{item.cvssScore.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">CVSS</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-mono text-accent mb-1">{item.cveId}</div>
              <div className="text-sm font-medium">Vendor: <span className="text-white">{item.vendor}</span></div>
            </div>
            <div className="text-right">
              {item.patchAvailable ? (
                <span className="text-success flex items-center gap-1 font-medium text-sm"><ShieldAlert className="h-4 w-4" /> Patch Available</span>
              ) : (
                <span className="text-warning flex items-center gap-1 font-medium text-sm"><ShieldAlert className="h-4 w-4" /> No Patch</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 border-b border-white/10 pb-6">
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {formatDate(item.publishedAt)}</span>
            {item.patchUrl && (
              <a href={item.patchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <ExternalLink className="h-4 w-4" /> Patch Link
              </a>
            )}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">Description</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>

          <div className="space-y-3">
            <AccordionSection
              title={`Affected Products (${item.affectedProducts.length})`}
              sectionKey="products"
              expanded={expandedSections.products}
              onToggle={() => toggleSection("products")}
              icon={Target}
              color="text-yellow-400"
            >
              <div className="flex flex-wrap gap-2">
                {item.affectedProducts.map((p: string) => (
                  <span key={p} className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded border border-yellow-500/20">{p}</span>
                ))}
              </div>
            </AccordionSection>

            {item.workarounds.length > 0 && (
              <AccordionSection
                title={`Mitigation / Workarounds (${item.workarounds.length})`}
                sectionKey="workarounds"
                expanded={expandedSections.workarounds}
                onToggle={() => toggleSection("workarounds")}
                icon={Shield}
                color="text-green-400"
              >
                <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
                  {item.workarounds.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </AccordionSection>
            )}

            {item.references.length > 0 && (
              <AccordionSection
                title={`References (${item.references.length})`}
                sectionKey="refs"
                expanded={expandedSections.refs}
                onToggle={() => toggleSection("refs")}
                icon={FileText}
                color="text-blue-400"
              >
                <ul className="space-y-1.5">
                  {item.references.map((ref: string, i: number) => (
                    <li key={i}>
                      <a href={ref} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                        {ref}
                      </a>
                    </li>
                  ))}
                </ul>
              </AccordionSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Advisories() {
  const [selectedItem, setSelectedItem] = useState<Advisory | null>(null);
  const { data, isLoading } = useGetAdvisories({ limit: 20 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" /> Security Advisories
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage CVEs, patches, and vulnerabilities.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No advisories found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data?.items.map(item => (
            <AdvisoryCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
          ))}
        </div>
      )}

      <AdvisoryDetailPanel
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

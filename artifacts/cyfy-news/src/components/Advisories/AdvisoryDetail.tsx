import { useState } from "react";
import {
  ShieldAlert,
  Calendar,
  Target,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Shield,
  FileText,
  Download,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/shared";
import { formatDate, stripHtml } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import type { Advisory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function getCvssColor(score: number): string {
  if (score >= 9.0) return "var(--danger-red)";
  if (score >= 7.0) return "var(--accent-amber)";
  if (score >= 4.0) return "var(--warning-yellow)";
  return "var(--success-green)";
}

function AccordionSection({
  title,
  sectionKey,
  expanded,
  onToggle,
  children,
  icon: Icon,
  color,
}: {
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
        className={cn(
          "w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left",
          color
        )}
      >
        <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider">
          <Icon className="h-4 w-4" /> {title}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
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

interface AdvisoryDetailProps {
  item: Advisory | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AdvisoryDetail({ item, isOpen, onClose }: AdvisoryDetailProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    workarounds: true,
    products: true,
    refs: false,
  });

  if (!item) return null;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const severityBg =
    item.severity === "critical"
      ? "var(--danger-red)"
      : item.severity === "high"
        ? "var(--accent-amber)"
        : item.severity === "medium"
          ? "var(--warning-yellow)"
          : item.severity === "low"
            ? "var(--success-green)"
            : "var(--primary-teal)";

  const cvssColor = getCvssColor(item.cvssScore);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border/50 shadow-2xl overflow-y-auto custom-scrollbar transition-transform duration-500 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div
          className="h-2 w-full"
          style={{ backgroundColor: severityBg }}
        />

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 flex-wrap">
              <SeverityBadge severity={item.severity} />
              <Badge variant="outline" className="uppercase text-[10px]">
                {item.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const res = await fetch(`/api/export/advisory/${item.id}`);
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${item.cveId}-advisory.html`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
                Export as HTML
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-4 font-sans leading-tight">
            {item.title}
          </h2>

          <div className="flex items-center gap-4 p-4 bg-background/50 rounded-xl border border-white/5 mb-6">
            <div className="text-center px-4 border-r border-white/10">
              <div
                className="text-3xl font-mono font-bold"
                style={{ color: cvssColor }}
              >
                {item.cvssScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                CVSS
              </div>
            </div>
            <div className="flex-1">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${item.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-primary hover:underline mb-1 block"
              >
                {item.cveId}
              </a>
              <div className="text-sm font-medium">
                Vendor: <span className="text-white">{item.vendor}</span>
              </div>
            </div>
            <div className="text-right">
              {item.patchAvailable ? (
                <span className="text-success flex items-center gap-1 font-medium text-sm">
                  <ShieldAlert className="h-4 w-4" /> Patch Available
                </span>
              ) : (
                <span className="text-warning flex items-center gap-1 font-medium text-sm">
                  <ShieldAlert className="h-4 w-4" /> No Patch
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 border-b border-white/10 pb-6">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {formatDate(item.publishedAt)}
            </span>
            {item.patchUrl && (
              <a
                href={item.patchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> Patch Link
              </a>
            )}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
              Description
            </h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {stripHtml(item.description ?? "")}
            </p>
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
                  <span
                    key={p}
                    className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded border border-yellow-500/20"
                  >
                    {p}
                  </span>
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
                  {item.workarounds.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
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
                      <a
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all"
                      >
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

import { Target, Calendar, ShieldAlert, Download, Check } from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { formatDate } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import { IndiaBadge } from "@/components/Threats/IndiaBadge";
import type { Advisory } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function getCvssColor(score: number): string {
  if (score >= 9.0) return "var(--danger-red)";
  if (score >= 7.0) return "var(--accent-amber)";
  if (score >= 4.0) return "var(--warning-yellow)";
  return "var(--success-green)";
}

interface AdvisoryCardProps {
  item: Advisory;
  onClick?: () => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  showCheckbox?: boolean;
}

async function handleExportAdvisory(id: number) {
  const res = await fetch(`/api/export/advisory/${id}`);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `advisory-${id}.html`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export function AdvisoryCard({ item, onClick, selected, onToggleSelect, showCheckbox }: AdvisoryCardProps) {
  const cvssColor = getCvssColor(item.cvssScore);

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
          "h-full overflow-hidden flex flex-col cursor-pointer card-spec group",
          "bg-[var(--background-card)] border border-[rgba(0,149,175,0.2)] rounded-xl",
          `severity-${item.severity}`
        )}
      >
        <div className="p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {showCheckbox && onToggleSelect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(item.id);
                  }}
                  className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    selected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/50 hover:border-primary/50"
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>
              )}
              <div
                className="flex items-center justify-center w-12 h-12 rounded-lg bg-background border border-white/10 shrink-0 font-mono text-lg font-bold shadow-inner"
                style={{ color: cvssColor }}
              >
                {item.cvssScore.toFixed(1)}
              </div>
              <div>
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${item.cveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-mono text-primary hover:underline mb-1 block"
                >
                  {item.cveId}
                </a>
                <SeverityBadge severity={item.severity} />
                {(item.scope === "local" || item.isIndiaRelated) && (
                  <IndiaBadge item={{ scope: item.scope, isIndiaRelated: item.isIndiaRelated }} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportAdvisory(item.id).catch(console.error);
                }}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-primary"
                title="Export as HTML"
              >
                <Download className="h-4 w-4" />
              </button>
              <Badge
                variant="outline"
                className="border-white/10 uppercase text-[10px] tracking-wider"
              >
                {item.status.replace("_", " ")}
              </Badge>
            </div>
          </div>

          <h3 className="font-bold text-[17px] leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
          </h3>

          <div className="space-y-2 mt-auto">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
              <span className="line-clamp-1 text-xs">
                Affects: {item.vendor}{" "}
                {(item.affectedProducts ?? [])[0] ?? "N/A"}
                {(item.affectedProducts ?? []).length > 1 &&
                  ` +${(item.affectedProducts ?? []).length - 1}`}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-4 mt-4 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(item.publishedAt)}</span>
              </div>
              {item.patchAvailable ? (
                <span className="text-success flex items-center gap-1 font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" /> Patch Avail
                </span>
              ) : (
                <span className="text-warning flex items-center gap-1 font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" /> No Patch
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

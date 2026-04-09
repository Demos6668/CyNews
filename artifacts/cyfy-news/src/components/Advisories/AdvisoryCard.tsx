import { Calendar, ShieldCheck, ShieldAlert, Check, Download } from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { formatDate } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common/SeverityBadge";
import { CvssChip } from "@/components/Common/CvssChip";
import { IndiaBadge } from "@/components/Threats/IndiaBadge";
import type { Advisory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { exportAdvisoryHtml } from "@/lib/exportApi";
import { toast } from "sonner";

interface AdvisoryCardProps {
  item: Advisory;
  onClick?: () => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  showCheckbox?: boolean;
}

async function handleExportAdvisory(id: number) {
  const blob = await exportAdvisoryHtml(id);
  if (!blob) { toast.error("Export failed"); return; }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `advisory-${id}.html`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export function AdvisoryCard({ item, onClick, selected, onToggleSelect, showCheckbox }: AdvisoryCardProps) {
  const products = item.affectedProducts ?? [];
  const visibleProducts = products.slice(0, 3);
  const extraProducts = products.length - visibleProducts.length;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "h-full overflow-hidden flex flex-col cursor-pointer group card-spec",
        `severity-${item.severity}`
      )}
    >
      <div className="p-4 flex flex-col h-full gap-3">
        {/* Row 1: CVSS + CVE ID + severity + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {showCheckbox && onToggleSelect && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  selected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40 hover:border-primary/60"
                )}
                aria-label={selected ? "Deselect advisory" : "Select advisory"}
              >
                {selected && <Check className="h-3 w-3" />}
              </button>
            )}
            <CvssChip score={item.cvssScore} />
            <div className="min-w-0">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${item.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-mono text-primary hover:underline block leading-tight mb-1"
              >
                {item.cveId}
              </a>
              <div className="flex items-center gap-1.5 flex-wrap">
                <SeverityBadge severity={item.severity} />
                {(item.scope === "local" || item.isIndiaRelated) && (
                  <IndiaBadge item={{ scope: item.scope, isIndiaRelated: item.isIndiaRelated }} />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handleExportAdvisory(item.id).catch(() => toast.error("Export failed")); }}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-primary"
              title="Export as HTML"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <Badge
              variant="outline"
              className="border-white/10 uppercase text-[10px] tracking-wider"
            >
              {item.status.replace("_", " ")}
            </Badge>
          </div>
        </div>

        {/* Row 2: Title */}
        <h3 className="font-semibold text-[15px] leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {item.title}
        </h3>

        {/* Row 3: Vendor + product chips */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          {item.vendor && (
            <span className="text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border/50 rounded px-2 py-0.5">
              {item.vendor}
            </span>
          )}
          {visibleProducts.map((p) => (
            <span key={p} className="text-[11px] text-muted-foreground bg-muted/20 border border-border/30 rounded px-1.5 py-0.5 line-clamp-1 max-w-[100px]" title={p}>
              {p}
            </span>
          ))}
          {extraProducts > 0 && (
            <span className="text-[11px] text-muted-foreground">+{extraProducts}</span>
          )}
        </div>

        {/* Row 4: Footer */}
        <div className="flex items-center justify-between text-[11px] pt-3 border-t border-border/40">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(item.publishedAt)}</span>
          </div>
          {item.patchAvailable ? (
            <span className="text-success flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3 w-3" /> Patch Avail
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> No Patch
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

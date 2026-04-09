import { AlertCircle, Calendar, Check, ChevronRight, ExternalLink, Tag } from "lucide-react";
import { Card } from "@/components/ui/shared";
import { formatDate } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import type { Advisory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface CertInAdvisoryCardProps {
  advisory: Advisory;
  onClick?: () => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  showCheckbox?: boolean;
}

export function CertInAdvisoryCard({ advisory, onClick, selected, onToggleSelect, showCheckbox }: CertInAdvisoryCardProps) {
  const cveCount = advisory.cveIds?.length ?? 0;
  const cveIds = advisory.cveIds ?? [];

  return (
    <div className="h-full">
      <Card
        onClick={onClick}
        className={cn(
          "h-full overflow-hidden flex flex-col cursor-pointer group card-spec",
          `severity-${advisory.severity}`
        )}
      >
        <div className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {showCheckbox && onToggleSelect && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(advisory.id);
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
                <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-mono font-bold rounded">
                  {advisory.certInId ?? advisory.cveId}
                </span>
                <SeverityBadge severity={advisory.severity} />
                {advisory.category && (
                  <span className="px-2 py-1 bg-muted/50 text-muted-foreground text-xs rounded">
                    {advisory.category}
                  </span>
                )}
                {cveCount > 0 && (
                  <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded">
                    {cveCount} CVE{cveCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <h3 className="font-bold text-[17px] leading-snug mb-2 group-hover:text-orange-400 transition-colors line-clamp-2">
                {advisory.title}
              </h3>

              {(advisory.summary ?? advisory.description) && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {advisory.summary ?? advisory.description}
                </p>
              )}

              {advisory.affectedProducts && advisory.affectedProducts.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {advisory.affectedProducts.slice(0, 3).map((product, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-muted/50 text-foreground text-xs rounded"
                      >
                        {product}
                      </span>
                    ))}
                    {advisory.affectedProducts.length > 3 && (
                      <span className="px-2 py-0.5 text-muted-foreground text-xs">
                        +{advisory.affectedProducts.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {cveIds.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {cveIds.slice(0, 3).map((cve, idx) => (
                      <a
                        key={idx}
                        href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded font-mono hover:bg-destructive/20"
                      >
                        {cve}
                      </a>
                    ))}
                    {cveIds.length > 3 && (
                      <span className="px-2 py-0.5 text-muted-foreground text-xs">
                        +{cveIds.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-3 border-t border-border/50">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(advisory.publishedAt)}
                </span>
                {advisory.cvssScore > 0 && (
                  <span className="flex items-center gap-1">
                    CVSS: {advisory.cvssScore.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {advisory.sourceUrl && (
                <a
                  href={advisory.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                  title="View on CERT-In"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-orange-400 transition-colors" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

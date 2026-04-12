import { useState, useEffect } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  ShieldAlert,
  Calendar,
  Target,
  ExternalLink,
  Shield,
  FileText,
  Download,
  CheckCircle,
  Mail,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/shared";
import { EmailExportModal } from "@/components/Export";
import { exportAdvisoryHtml } from "@/lib/exportApi";
import { formatDate, stripHtml } from "@/lib/utils";
import {
  getPatchAdvisoryLinkLabel,
  getPrimaryAdvisoryLinkLabel,
  normalizeAdvisoryLinks,
} from "@/lib/advisoryLinks";
import { SeverityBadge, AccordionSection } from "@/components/Common";
import type { Advisory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { getCvssHex, getSeverityToken } from "@/lib/design-tokens";
import { addRecentItem } from "@/lib/recentlyViewed";

interface AdvisoryDetailProps {
  item: Advisory | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AdvisoryDetail({ item, isOpen, onClose }: AdvisoryDetailProps) {
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // Track this item as recently viewed when the panel opens
  useEffect(() => {
    if (isOpen && item) {
      addRecentItem({ id: item.id, type: "advisory", title: item.title, severity: item.severity });
      window.dispatchEvent(new Event("cyfy:history-updated"));
    }
  }, [isOpen, item?.id]);

  const [emailExportOpen, setEmailExportOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    workarounds: true,
    products: true,
    refs: false,
    summary: false,
    content: true,
    recommendations: true,
  });

  if (!item) return null;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const severityBg = getSeverityToken(item.severity).hex;
  const unscored = item.cvssScore === 0;
  const cvssColor = unscored ? "rgba(255,255,255,0.3)" : getCvssHex(item.cvssScore);
  const isCertIn = item.isCertIn ?? false;
  const links = normalizeAdvisoryLinks(item);
  const primaryLinkLabel = getPrimaryAdvisoryLinkLabel(item);
  const patchLinkLabel = getPatchAdvisoryLinkLabel();

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={item?.title ?? "Advisory detail"}
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
          className={cn(
            "h-2 w-full",
            isCertIn ? "bg-gradient-to-r from-orange-500 to-orange-600" : ""
          )}
          style={!isCertIn ? { backgroundColor: severityBg } : undefined}
        />

        <div className={cn("p-8", isCertIn && "border-b border-orange-500/20")}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 flex-wrap">
              {isCertIn && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  CERT-In Official
                </Badge>
              )}
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
                onClick={() => setEmailExportOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Export as Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const blob = await exportAdvisoryHtml(item.id);
                  if (!blob) return;
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${item.cveId || `advisory-${item.id}`}-advisory.html`;
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

          {(item.certInId ?? item.cveId) && (
            <div className="text-sm font-mono text-muted-foreground mb-2">
              {item.certInId ?? item.cveId}
              {isCertIn && (item.category ?? item.certInType) && (
                <span className="ml-3 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                  {item.category ?? item.certInType}
                </span>
              )}
            </div>
          )}

          <h2 className="text-3xl font-bold mb-4 font-sans leading-tight">
            {item.title}
          </h2>

          <div className="flex items-center gap-4 p-4 bg-background/50 rounded-xl border border-white/5 mb-6">
            <div className="text-center px-4 border-r border-white/10">
              <div
                className="text-3xl font-mono font-bold"
                style={{ color: cvssColor }}
                title={unscored ? "Not yet scored by NVD" : undefined}
              >
                {unscored ? "N/A" : item.cvssScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                CVSS
              </div>
            </div>
            <div className="flex-1">
              {item.cveIds && item.cveIds.length > 0 ? (
                <div className="space-y-1">
                  {item.cveIds.slice(0, 3).map((cve) => (
                    <a
                      key={cve}
                      href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-primary hover:underline block"
                    >
                      {cve}
                    </a>
                  ))}
                  {item.cveIds.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{item.cveIds.length - 3} more
                    </span>
                  )}
                </div>
              ) : (
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${item.cveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-primary hover:underline mb-1 block"
                >
                  {item.cveId}
                </a>
              )}
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
            {links.sourceUrl && (
              <a
                href={links.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> {primaryLinkLabel}
              </a>
            )}
            {links.patchUrl && (
              <a
                href={links.patchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> {patchLinkLabel}
              </a>
            )}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
              Description
            </h3>
            {/^information published\.?$/i.test(stripHtml(item.description ?? "").trim()) ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground text-sm leading-relaxed">
                  Full details are pending NVD processing.{" "}
                  {item.cveId && (
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${item.cveId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View on NVD →
                    </a>
                  )}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {stripHtml(item.description ?? "")}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {isCertIn && item.summary && item.summary !== item.description && (
              <AccordionSection
                title="Summary"
                sectionKey="summary"
                expanded={expandedSections.summary}
                onToggle={() => toggleSection("summary")}
                icon={FileText}
                color="text-orange-400"
              >
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {stripHtml(item.summary)}
                </p>
              </AccordionSection>
            )}

            {isCertIn && item.content && (
              <AccordionSection
                title="Full Content"
                sectionKey="content"
                expanded={expandedSections.content}
                onToggle={() => toggleSection("content")}
                icon={FileText}
                color="text-orange-400"
              >
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {stripHtml(item.content)}
                </p>
              </AccordionSection>
            )}

            {item.affectedProducts.length > 0 && (
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
            )}

            {(item.recommendations && item.recommendations.length > 0) && (
              <AccordionSection
                title={`Recommendations (${item.recommendations.length})`}
                sectionKey="recommendations"
                expanded={expandedSections.recommendations}
                onToggle={() => toggleSection("recommendations")}
                icon={CheckCircle}
                color="text-green-400"
              >
                <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
                  {item.recommendations.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </AccordionSection>
            )}

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

            {links.references.length > 0 && (
              <AccordionSection
                title={`References (${links.references.length})`}
                sectionKey="refs"
                expanded={expandedSections.refs}
                onToggle={() => toggleSection("refs")}
                icon={FileText}
                color="text-blue-400"
              >
                <ul className="space-y-1.5">
                  {links.references.map((ref: string, i: number) => (
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

          {(links.sourceUrl || links.patchUrl) && (
            <div className="mt-8 pt-6 border-t border-border">
              <div className="flex flex-wrap gap-3">
                {links.sourceUrl && (
                  <a
                    href={links.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border",
                      isCertIn
                        ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-orange-500/30"
                        : "bg-primary/10 text-primary hover:bg-primary/15 border-primary/20"
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {primaryLinkLabel}
                  </a>
                )}
                {links.patchUrl && (
                  <a
                    href={links.patchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border bg-background/60 text-foreground hover:bg-background border-border"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {patchLinkLabel}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <EmailExportModal
        advisory={item}
        isOpen={emailExportOpen}
        onClose={() => setEmailExportOpen(false)}
      />
    </div>
  );
}

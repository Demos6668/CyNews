import { useState, useEffect } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  Crosshair,
  Shield,
  Target,
  Calendar,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/shared";
import { formatDate, stripHtml } from "@/lib/utils";
import { SeverityBadge, AccordionSection } from "@/components/Common";
import type { ThreatIntelItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { normalizeThreatLinks } from "@/lib/threatLinks";
import { getSeverityToken } from "@/lib/design-tokens";
import { addRecentItem } from "@/lib/recentlyViewed";

/** Returns a MITRE ATT&CK URL for a technique ID like T1059 or T1059.001 */
function mitreUrl(ttp: string): string | null {
  const match = ttp.match(/T(\d{4})(?:\.(\d{3}))?/i);
  if (!match) return null;
  const base = `https://attack.mitre.org/techniques/T${match[1]}`;
  return match[2] ? `${base}/${match[2]}/` : `${base}/`;
}

interface ThreatModalProps {
  item: ThreatIntelItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ThreatModal({ item, isOpen, onClose }: ThreatModalProps) {
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen && item) {
      addRecentItem({ id: item.id, type: "threat", title: item.title, severity: item.severity });
      window.dispatchEvent(new Event("cyfy:history-updated"));
    }
  }, [isOpen, item?.id]);

  const [copiedIoc, setCopiedIoc] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ttps: true,
    iocs: true,
    mitigations: true,
    malware: true,
    systems: true,
  });

  if (!item) return null;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const severityBg = getSeverityToken(item.severity).hex;
  const links = normalizeThreatLinks(item);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={item?.title ?? "Threat detail"}
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
              <Badge variant="outline">{item.category}</Badge>
              <Badge variant="outline" className="uppercase text-[10px]">
                {item.status}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {item.confidenceLevel}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              ✕
            </Button>
          </div>

          <h2 className="text-3xl font-bold mb-2 font-sans leading-tight">
            {item.title}
          </h2>

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
            <div className="text-sm text-accent mb-4 font-mono">
              Campaign: {item.campaignName}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 border-b border-white/10 pb-6 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {formatDate(item.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <ExternalLink className="h-4 w-4" /> {item.source}
            </span>
            {item.firstSeen && (
              <span className="text-xs">
                First seen: {formatDate(item.firstSeen)}
              </span>
            )}
            {item.lastSeen && (
              <span className="text-xs">
                Last seen: {formatDate(item.lastSeen)}
              </span>
            )}
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {item.targetSectors.map((s: string) => (
                <span
                  key={s}
                  className="text-xs bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20"
                >
                  {s}
                </span>
              ))}
            </div>
            {item.targetRegions.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Regions: {item.targetRegions.join(", ")}
              </div>
            )}
          </div>

          {(() => {
            const strippedDescription = stripHtml(item.description ?? "").trim();
            const strippedSummary = stripHtml(item.summary ?? "").trim();
            return (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  Description
                </h3>
                {strippedDescription ? (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {strippedDescription}
                  </p>
                ) : strippedSummary && strippedSummary !== item.title ? (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {strippedSummary}
                  </p>
                ) : (
                  <p className="text-muted-foreground/60 italic">
                    No description available — view the original source for full details.
                  </p>
                )}
              </div>
            );
          })()}

          <div className="space-y-3">
            {item.ttps.length > 0 && (
              <AccordionSection
                title="TTPs (MITRE ATT&CK)"
                sectionKey="ttps"
                expanded={expandedSections.ttps}
                onToggle={() => toggleSection("ttps")}
                icon={Target}
                color="text-primary"
              >
                <ul className="space-y-1.5">
                  {item.ttps.map((ttp: string) => {
                    const url = mitreUrl(ttp);
                    return (
                      <li
                        key={ttp}
                        className="flex items-center justify-between gap-2 text-sm font-mono bg-background/50 px-3 py-1.5 rounded text-muted-foreground border border-white/5"
                      >
                        <span>{ttp}</span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 text-primary/60 hover:text-primary transition-colors"
                            title="View on MITRE ATT&CK"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionSection>
            )}

            {item.iocs.length > 0 && (
              <AccordionSection
                title="Indicators of Compromise"
                sectionKey="iocs"
                expanded={expandedSections.iocs}
                onToggle={() => toggleSection("iocs")}
                icon={Crosshair}
                color="text-destructive"
              >
                <div className="flex flex-wrap gap-2">
                  {item.iocs.map((ioc: string) => (
                    <div
                      key={ioc}
                      className="flex items-center gap-1 text-xs bg-destructive/10 border border-destructive/20 rounded overflow-hidden"
                    >
                      <code className="px-2 py-1 text-destructive-foreground select-all">{ioc}</code>
                      <button
                        type="button"
                        title="Copy to clipboard"
                        className="px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors border-l border-destructive/20"
                        onClick={() => {
                          navigator.clipboard.writeText(ioc).catch(() => undefined);
                          setCopiedIoc(ioc);
                          setTimeout(() => setCopiedIoc(null), 1500);
                        }}
                      >
                        {copiedIoc === ioc ? (
                          <Check className="w-3 h-3 text-success" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <a
                        href={`https://www.virustotal.com/gui/search/${encodeURIComponent(ioc)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Search on VirusTotal"
                        className="px-1.5 py-1 text-muted-foreground hover:text-orange-400 transition-colors border-l border-destructive/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {item.malwareFamilies && item.malwareFamilies.length > 0 && (
              <AccordionSection
                title="Malware Families"
                sectionKey="malware"
                expanded={expandedSections.malware}
                onToggle={() => toggleSection("malware")}
                icon={Shield}
                color="text-orange-400"
              >
                <div className="flex flex-wrap gap-2">
                  {item.malwareFamilies.map((m: string) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="border-orange-400/30 text-orange-400"
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              </AccordionSection>
            )}

            {item.mitigations.length > 0 && (
              <AccordionSection
                title="Mitigations"
                sectionKey="mitigations"
                expanded={expandedSections.mitigations}
                onToggle={() => toggleSection("mitigations")}
                icon={Shield}
                color="text-green-400"
              >
                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm">
                  {item.mitigations.map((m: string) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </AccordionSection>
            )}

            {item.affectedSystems.length > 0 && (
              <AccordionSection
                title="Affected Systems"
                sectionKey="systems"
                expanded={expandedSections.systems}
                onToggle={() => toggleSection("systems")}
                icon={Target}
                color="text-yellow-400"
              >
                <div className="flex flex-wrap gap-2">
                  {item.affectedSystems.map((s: string) => (
                    <span
                      key={s}
                      className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded border border-yellow-500/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </AccordionSection>
            )}

            {links.references.length > 0 && (
              <AccordionSection
                title={`References (${links.references.length})`}
                sectionKey="references"
                expanded={expandedSections.references ?? false}
                onToggle={() => toggleSection("references")}
                icon={ExternalLink}
                color="text-blue-400"
              >
                <ul className="space-y-1.5">
                  {links.references.map((ref: string) => (
                    <li key={ref}>
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

            {links.sourceUrl && (
              <a
                href={links.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-6 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors w-fit"
              >
                <ExternalLink className="h-4 w-4" />
                View Original Source ({item.source})
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

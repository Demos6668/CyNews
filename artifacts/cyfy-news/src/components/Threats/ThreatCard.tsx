import { Shield, Calendar, ExternalLink } from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { formatRelative, stripHtml } from "@/lib/utils";
import { SeverityBadge } from "@/components/Common";
import { IndiaBadge } from "./IndiaBadge";
import type { ThreatIntelItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { normalizeThreatLinks } from "@/lib/threatLinks";

interface ThreatCardProps {
  item: ThreatIntelItem;
  onClick?: () => void;
}

export function ThreatCard({ item, onClick }: ThreatCardProps) {
  const links = normalizeThreatLinks(item);

  return (
    <div className="h-full">
      <Card
        onClick={onClick}
        className={cn(
          "h-full overflow-hidden flex flex-col cursor-pointer card-spec group border-0 bg-transparent shadow-none rounded-none pl-5",
          `severity-${item.severity}`
        )}
      >
        <div className="pr-5 py-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex flex-wrap gap-2">
              <SeverityBadge severity={item.severity} />
              <Badge
                variant="outline"
                className="border-white/10 text-muted-foreground bg-background/50"
              >
                {item.category}
              </Badge>
              {item.confidenceLevel === "confirmed" && (
                <Badge
                  variant="secondary"
                  className="bg-green-500/20 text-green-400"
                >
                  CONFIRMED
                </Badge>
              )}
              {item.scope === "local" && (
                <Badge
                  variant="secondary"
                  className="bg-orange-500/20 text-orange-400"
                >
                  LOCAL
                </Badge>
              )}
            </div>
          </div>

          {item.scope === "local" && (
            <div className="mb-2">
              <IndiaBadge item={item} />
            </div>
          )}

          {item.threatActor && (
            <div className="text-xs font-mono text-primary mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" /> {item.threatActor}
              {item.campaignName && (
                <span className="text-muted-foreground ml-2">
                  • {item.campaignName}
                </span>
              )}
            </div>
          )}

          <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
          </h3>

          <p className="text-muted-foreground text-sm flex-grow line-clamp-5 mb-4">
            {stripHtml(item.summary ?? "")}
          </p>

          {(item.ttps ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(item.ttps ?? []).slice(0, 2).map((ttp: string) => (
                <span
                  key={ttp}
                  className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                >
                  {ttp.split(" - ")[0]}
                </span>
              ))}
              {(item.ttps ?? []).length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{(item.ttps ?? []).length - 2} more
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatRelative(item.publishedAt)}</span>
            </div>
            {links.sourceUrl ? (
              <a
                href={links.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-[10px] opacity-70 px-2 py-0.5 hover:text-primary hover:opacity-100 flex items-center gap-1 transition-colors"
              >
                {item.source}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono text-[10px] opacity-70 px-2 py-0.5">
                {item.source}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

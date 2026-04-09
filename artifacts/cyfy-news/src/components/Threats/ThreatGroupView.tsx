import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SeverityBadge, type Severity } from "@/components/Common/SeverityBadge";
import { ThreatCard } from "./ThreatCard";
import type { ThreatIntelItem } from "@workspace/api-client-react";

interface ThreatGroup {
  key: string;
  count: number;
  items: ThreatIntelItem[];
}

interface ThreatGroupViewProps {
  groups: ThreatGroup[];
  total: number;
  groupBy: string;
  onItemClick: (item: ThreatIntelItem) => void;
}

const SEVERITY_LEVELS = ["critical", "high", "medium", "low", "info"] as const;

function SeverityBar({ items }: { items: ThreatIntelItem[] }) {
  const counts = SEVERITY_LEVELS.map((s) => ({
    severity: s,
    count: items.filter((i) => i.severity === s).length,
  })).filter((c) => c.count > 0);

  if (counts.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {counts.map(({ severity, count }) => (
        <SeverityBadge key={severity} severity={severity as Severity} className="py-0 text-[10px]">
          {count} {severity}
        </SeverityBadge>
      ))}
    </div>
  );
}

function GroupSection({
  group,
  onItemClick,
}: {
  group: ThreatGroup;
  onItemClick: (item: ThreatIntelItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-white/5 bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-semibold text-sm truncate">{group.key}</span>
          <span className="shrink-0 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
            {group.count}
          </span>
        </div>
        <div className="ml-4 shrink-0">
          <SeverityBar items={group.items} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((item) => (
              <ThreatCard key={item.id} item={item} onClick={() => onItemClick(item)} />
            ))}
          </div>
          {group.count > group.items.length && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Showing {group.items.length} of {group.count} — use filters to narrow results
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ThreatGroupView({ groups, total, groupBy, onItemClick }: ThreatGroupViewProps) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No threats found for the selected filters.
      </div>
    );
  }

  const label = {
    category: "Category",
    severity: "Severity",
    threat_actor: "Threat Actor / Campaign",
    source: "Source",
  }[groupBy] ?? groupBy;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {groups.length} groups · {total} threats · grouped by <span className="font-medium text-foreground">{label}</span>
      </p>
      {groups.map((group) => (
        <GroupSection key={group.key} group={group} onItemClick={onItemClick} />
      ))}
    </div>
  );
}

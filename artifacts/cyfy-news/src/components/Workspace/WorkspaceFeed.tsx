import { useCallback, useEffect, useState } from "react";
import {
  Target,
  CheckCircle,
  RefreshCw,
  Plus,
  Trash2,
  Wrench,
  RotateCcw,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { ThreatModal } from "@/components/Threats/ThreatModal";
import { AddProductModal } from "./AddProductModal";
import { Badge, Button, Skeleton } from "@/components/ui/shared";
import { cn, formatRelative, getSeverityBadgeColors, stripHtml } from "@/lib/utils";
import type { ThreatIntelItem } from "@workspace/api-client-react";
import {
  getWorkspace,
  getWorkspaceFeed,
  matchWorkspaceThreats,
  removeProduct as apiRemoveProduct,
  updateMatch,
} from "@workspace/api-client-react";
import type { WorkspaceSectionCounts, WorkspaceSectionKey } from "./WorkspaceSidebar";
import { SeverityBadge } from "@/components/Common";
import { normalizeThreatLinks } from "@/lib/threatLinks";

interface WorkspaceProduct {
  id: string;
  productName: string;
  vendor?: string | null;
  version?: string | null;
  category?: string | null;
}

interface Workspace {
  id: string;
  name: string;
  domain: string;
  description?: string | null;
  products?: WorkspaceProduct[];
}

type FeedSeverity = "critical" | "high" | "medium" | "low" | "info";
type MatchStatus = "active" | "resolved";

interface FeedItem extends ThreatIntelItem {
  matchId?: string;
  matchedProduct?: string;
  relevanceScore?: number;
  reviewed?: boolean;
  matchStatus?: MatchStatus;
  resolvedAt?: string | null;
  resolvedSeverity?: FeedSeverity | null;
}

interface WorkspaceFeedProps {
  workspace: Workspace;
  selectedSection: WorkspaceSectionKey | null;
  onSectionCountsChange: (counts: WorkspaceSectionCounts) => void;
}

const sectionMeta: Record<WorkspaceSectionKey, { title: string; description: string; empty: string }> = {
  high: {
    title: "High Alerts",
    description: "Critical and high-severity alerts matched to this workspace.",
    empty: "No critical or high alerts are currently matched to this workspace.",
  },
  medium: {
    title: "Medium Alerts",
    description: "Medium-severity items that still need attention.",
    empty: "No medium alerts are currently matched to this workspace.",
  },
  low: {
    title: "Low Alerts",
    description: "Lower-severity items that are still associated with this workspace.",
    empty: "No low alerts are currently matched to this workspace.",
  },
  info: {
    title: "Info Cards",
    description: "Informational cards relevant to the products in this workspace.",
    empty: "No informational cards are currently matched to this workspace.",
  },
  resolved: {
    title: "Patch Visibility",
    description: "Resolved or patched items remain visible here for tracking and history.",
    empty: "No resolved or patched alerts are being tracked for this workspace yet.",
  },
};

function getBucketForSeverity(severity: FeedSeverity): Exclude<WorkspaceSectionKey, "resolved"> {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  if (severity === "low") return "low";
  return "info";
}

function getResolvedSeverity(item: FeedItem): FeedSeverity {
  return item.resolvedSeverity ?? item.severity;
}

export function WorkspaceFeed({
  workspace,
  selectedSection,
  onSectionCountsChange,
}: WorkspaceFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [selectedItem, setSelectedItem] = useState<ThreatIntelItem | null>(null);

  const fetchWorkspace = useCallback(() => {
    getWorkspace(workspace.id)
      .then((data) => setProducts((data as { products?: WorkspaceProduct[] }).products ?? []))
      .catch(() => setProducts([]));
  }, [workspace.id]);

  const fetchFeed = useCallback(() => {
    setLoading(true);
    getWorkspaceFeed(workspace.id, { limit: 100 })
      .then((data) => {
        setItems((data.items ?? []) as FeedItem[]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [workspace.id]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const activeItems = items.filter((item) => item.matchStatus !== "resolved");
  const resolvedItems = items.filter((item) => item.matchStatus === "resolved");

  const groupedActiveItems: Record<Exclude<WorkspaceSectionKey, "resolved">, FeedItem[]> = {
    high: [],
    medium: [],
    low: [],
    info: [],
  };

  for (const item of activeItems) {
    groupedActiveItems[getBucketForSeverity(item.severity)].push(item);
  }

  const counts: WorkspaceSectionCounts = {
    high: groupedActiveItems.high.length,
    medium: groupedActiveItems.medium.length,
    low: groupedActiveItems.low.length,
    info: groupedActiveItems.info.length,
    resolved: resolvedItems.length,
  };

  useEffect(() => {
    onSectionCountsChange(counts);
  }, [counts.high, counts.info, counts.low, counts.medium, counts.resolved, onSectionCountsChange]);

  const effectiveSection: WorkspaceSectionKey = selectedSection ?? "high";
  const displayedItems = effectiveSection === "resolved"
    ? resolvedItems
    : groupedActiveItems[effectiveSection];

  const matchedProducts = [
    ...new Set(activeItems.map((item) => item.matchedProduct).filter(Boolean)),
  ] as string[];

  const handleRemoveProduct = async (productId: string) => {
    try {
      await apiRemoveProduct(workspace.id, productId);
      setProducts((prev) => prev.filter((product) => product.id !== productId));
      fetchFeed();
    } catch {
      // keep the UI stable; the next refresh can recover
    }
  };

  const handleMatch = async () => {
    setMatching(true);
    try {
      await matchWorkspaceThreats(workspace.id);
      fetchFeed();
    } catch {
      // silently fail
    } finally {
      setMatching(false);
    }
  };

  const handleReview = async (matchId: string) => {
    try {
      await updateMatch(workspace.id, matchId, { reviewed: true });
      setItems((prev) =>
        prev.map((item) => (item.matchId === matchId ? { ...item, reviewed: true } : item))
      );
    } catch {
      // silently fail
    }
  };

  const handleResolve = async (item: FeedItem, nextStatus: MatchStatus) => {
    if (!item.matchId) return;

    try {
      await updateMatch(workspace.id, item.matchId, { matchStatus: nextStatus });
      setItems((prev) =>
        prev.map((current) =>
          current.matchId === item.matchId
            ? {
                ...current,
                reviewed: nextStatus === "resolved" ? true : current.reviewed,
                matchStatus: nextStatus,
                resolvedAt: nextStatus === "resolved" ? new Date().toISOString() : null,
                resolvedSeverity:
                  nextStatus === "resolved"
                    ? (current.resolvedSeverity ?? current.severity)
                    : null,
              }
            : current
        )
      );
    } catch {
      // silently fail
    }
  };

  const renderTimelineItem = (item: FeedItem, status: MatchStatus) => {
    const resolvedSeverity = getResolvedSeverity(item);
    const links = normalizeThreatLinks(item);

    return (
      <div
        key={`${status}-${item.matchId ?? item.id}`}
        className={cn(
          "relative pl-12 py-5 border-b border-border/40 last:border-b-0 transition-colors",
          "hover:bg-white/[0.02]"
        )}
      >
        <div
          className={cn(
            "absolute left-2 top-7 h-4 w-4 rounded-full border-2 border-background",
            resolvedSeverity === "critical" && "bg-destructive",
            resolvedSeverity === "high" && "bg-accent",
            resolvedSeverity === "medium" && "bg-warning",
            resolvedSeverity === "low" && "bg-success",
            resolvedSeverity === "info" && "bg-primary"
          )}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedItem(item)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelectedItem(item);
            }
          }}
          className="space-y-3 cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={resolvedSeverity} />
            <Badge variant="outline" className="border-white/10 text-muted-foreground bg-transparent">
              {item.category}
            </Badge>
            {item.matchedProduct && (
              <Badge
                variant="outline"
                className="border-amber-400/30 bg-amber-500/10 text-amber-300"
              >
                {item.matchedProduct}
              </Badge>
            )}
            {status === "resolved" ? (
              <Badge
                variant="outline"
                className={cn("border-transparent", getSeverityBadgeColors(resolvedSeverity))}
              >
                Resolved {resolvedSeverity === "critical"
                  ? "Critical"
                  : resolvedSeverity.charAt(0).toUpperCase() + resolvedSeverity.slice(1)}
              </Badge>
            ) : item.reviewed ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              >
                Reviewed
              </Badge>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Calendar className="h-3.5 w-3.5" />
              {formatRelative(item.publishedAt)}
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold leading-tight text-foreground">
              {item.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {stripHtml(item.summary ?? "")}
            </p>
          </div>
        </div>
        {(item.matchId || links.sourceUrl || (status === "resolved" && item.resolvedAt)) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.matchId && status === "active" && !item.reviewed && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-success border-success/30"
                onClick={() => handleReview(item.matchId!)}
              >
                <CheckCircle className="w-3 h-3" />
                Reviewed
              </Button>
            )}
            {item.matchId && status === "active" ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-primary/30 text-primary"
                onClick={() => handleResolve(item, "resolved")}
              >
                <Wrench className="w-3 h-3" />
                Mark resolved
              </Button>
            ) : item.matchId ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-border/70"
                onClick={() => handleResolve(item, "active")}
              >
                <RotateCcw className="w-3 h-3" />
                Restore active
              </Button>
            ) : null}
            {links.sourceUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-border/60"
                onClick={() => window.open(links.sourceUrl!, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="w-3 h-3" />
                Source
              </Button>
            )}
            {status === "resolved" && item.resolvedAt && (
              <span className="text-xs text-muted-foreground">
                Resolved {formatRelative(item.resolvedAt)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const criticalCount = activeItems.filter((item) => item.severity === "critical").length;
  const sectionDetails = sectionMeta[effectiveSection];

  return (
    <div className="space-y-4">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <p className="text-muted-foreground mt-1">{workspace.domain}</p>
            {workspace.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-3xl line-clamp-2">{workspace.description}</p>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowAddProduct(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Add product
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleMatch}
                disabled={matching || loading}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", matching && "animate-spin")} />
                {matching ? "Matching…" : "Refresh matches"}
              </Button>
            </div>
            <div>
              <div className="text-3xl font-bold">{activeItems.length}</div>
              <div className="text-sm text-muted-foreground">Active matches</div>
              {criticalCount > 0 && (
                <div className="mt-2 text-xs text-destructive">
                  {criticalCount} critical in active tracking
                </div>
              )}
            </div>
          </div>
        </div>

        {(products.length > 0 || matchedProducts.length > 0) && (
          <div className="pt-3 border-t border-border/50 space-y-2">
            {products.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Products
                </span>
                <div className="flex flex-wrap gap-2">
                  {products.map((product) => (
                    <span
                      key={product.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm group"
                    >
                      {product.vendor ? `${product.productName} (${product.vendor})` : product.productName}
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(product.id)}
                        className="opacity-60 hover:opacity-100 hover:text-destructive transition-opacity"
                        title="Remove product"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {matchedProducts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Matches
                </span>
                <div className="flex flex-wrap gap-2">
                  {matchedProducts.map((product) => (
                    <span
                      key={product}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-amber-400 text-sm"
                    >
                      <Target className="w-3 h-3" />
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(loading || items.length > 0) && (
          <div className="pt-3 border-t border-border/50 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{sectionDetails.title}</h2>
                <Badge variant="outline" className="border-border/40 bg-transparent">
                  {counts[effectiveSection]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{sectionDetails.description}</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">{sectionDetails.empty}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border/60" />
              <div>
                {displayedItems.map((item) =>
                  renderTimelineItem(item, effectiveSection === "resolved" ? "resolved" : "active")
                )}
              </div>
            </div>
          )}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="pt-6 border-t border-border/50 text-center py-12">
          {products.length === 0 ? (
            <>
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Add products to get started</h3>
              <p className="text-muted-foreground mt-2 mb-4">
                Add the products and technologies you use to see relevant threat intelligence.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowAddProduct(true)}
              >
                <Plus className="w-4 h-4" />
                Add product
              </Button>
            </>
          ) : (
            <>
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold">All Clear!</h3>
              <p className="text-muted-foreground mt-2">
                No threats currently match your monitored products.
              </p>
            </>
          )}
          </div>
        )}
      </div>

      <ThreatModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
      <AddProductModal
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        workspaceId={workspace.id}
        onAdded={() => {
          fetchWorkspace();
          fetchFeed();
        }}
      />
    </div>
  );
}

export { WorkspaceFeed as workspaceFeed };

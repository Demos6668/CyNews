import { useEffect, useState, useCallback } from "react";
import { Target, AlertTriangle, CheckCircle, XCircle, RefreshCw, Plus, Trash2 } from "lucide-react";
import { ThreatCard } from "@/components/Threats/ThreatCard";
import { ThreatModal } from "@/components/Threats/ThreatModal";
import { AddProductModal } from "./AddProductModal";
import { Button, Skeleton } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import type { ThreatIntelItem } from "@workspace/api-client-react";
import {
  getWorkspace,
  getWorkspaceFeed,
  removeProduct as apiRemoveProduct,
  matchWorkspaceThreats,
  updateMatch,
} from "@workspace/api-client-react";

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

interface FeedItem extends ThreatIntelItem {
  matchId?: string;
  matchedProduct?: string;
  relevanceScore?: number;
  reviewed?: boolean;
}

interface WorkspaceFeedProps {
  workspace: Workspace;
  onReview?: (matchId: string) => void;
  onDismiss?: (matchId: string) => void;
}

export function WorkspaceFeed({ workspace, onReview, onDismiss }: WorkspaceFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
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
    getWorkspaceFeed(workspace.id, { limit: 50 })
      .then((data) => {
        setItems((data.items ?? []) as FeedItem[]);
        setTotal(data.total ?? 0);
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

  const handleRemoveProduct = async (productId: string) => {
    try {
      await apiRemoveProduct(workspace.id, productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      fetchFeed();
    } catch (e) {
      // silently fail — UI already reflects optimistic state
    }
  };

  const handleMatch = async () => {
    setMatching(true);
    try {
      await matchWorkspaceThreats(workspace.id);
      fetchFeed();
    } catch (e) {
      // silently fail
    } finally {
      setMatching(false);
    }
  };

  const criticalCount = items.filter((t) => t.severity === "critical").length;
  const matchedProducts = [...new Set(items.map((t) => t.matchedProduct).filter(Boolean))] as string[];

  const handleReview = async (matchId: string) => {
    try {
      await updateMatch(workspace.id, matchId, { reviewed: true });
      setItems((prev) =>
        prev.map((t) => (t.matchId === matchId ? { ...t, reviewed: true } : t))
      );
      onReview?.(matchId);
    } catch (e) {
      // silently fail
    }
  };

  const handleDismiss = async (matchId: string) => {
    try {
      await updateMatch(workspace.id, matchId, { dismissed: true });
      setItems((prev) => prev.filter((t) => t.matchId !== matchId));
      setTotal((t) => Math.max(0, t - 1));
      onDismiss?.(matchId);
    } catch (e) {
      // silently fail
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <p className="text-muted-foreground mt-1">{workspace.domain}</p>
            {workspace.description && (
              <p className="text-sm text-muted-foreground mt-2">{workspace.description}</p>
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
              <div className="text-3xl font-bold">{total}</div>
              <div className="text-sm text-muted-foreground">Relevant Threats</div>
              {criticalCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-destructive/20 text-destructive rounded-full text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  {criticalCount} Critical
                </div>
              )}
            </div>
          </div>
        </div>

        {(products.length > 0 || matchedProducts.length > 0) && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {products.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Monitored products:</p>
                <div className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background/80 border border-border rounded-full text-sm group"
                    >
                      {p.vendor ? `${p.productName} (${p.vendor})` : p.productName}
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(p.id)}
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
              <div>
                <p className="text-xs text-muted-foreground mb-2">Threats affecting your products:</p>
                <div className="flex flex-wrap gap-2">
                  {matchedProducts.map((product, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm"
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
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((threat) => (
              <div key={threat.id} className="relative">
                {threat.relevanceScore != null && (
                  <div
                    className="absolute -left-2 top-4 w-1 h-12 rounded-full z-10"
                    style={{
                      background:
                        threat.relevanceScore >= 70
                          ? "var(--danger-red)"
                          : threat.relevanceScore >= 40
                            ? "var(--accent-amber)"
                            : "var(--primary-teal)",
                    }}
                  />
                )}
                <div className="space-y-2">
                  <ThreatCard
                    item={threat}
                    onClick={() => setSelectedItem(threat)}
                  />
                  {threat.matchedProduct && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                        {threat.matchedProduct}
                      </span>
                    </div>
                  )}
                  {threat.matchId && (
                    <div className="flex gap-2">
                      {!threat.reviewed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-success border-success/30"
                          onClick={() => handleReview(threat.matchId!)}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Reviewed
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive border-destructive/30"
                        onClick={() => handleDismiss(threat.matchId!)}
                      >
                        <XCircle className="w-3 h-3" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
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

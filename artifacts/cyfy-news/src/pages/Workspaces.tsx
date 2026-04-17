import { useState } from "react";
import { Building2, Globe, Plus, Trash2, Star, AlertTriangle, Calendar, RotateCcw, Clock } from "lucide-react";
import {
  useListWorkspaces,
  useDeleteWorkspace,
  useRestoreWorkspace,
  useCreateWorkspace,
} from "@workspace/api-client-react";
import { CreateWorkspaceModal } from "@/components/Workspace";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/shared";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLocation } from "wouter";

interface WorkspaceCard {
  id: string;
  name: string;
  domain: string;
  description?: string | null;
  isDefault?: boolean;
  createdAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function Workspaces() {
  usePageTitle("Workspaces");
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const { data: workspaces = [], isLoading, refetch } = useListWorkspaces();
  const { mutateAsync: createWs } = useCreateWorkspace();
  const { mutateAsync: deleteWs } = useDeleteWorkspace();
  const { mutateAsync: restoreWs, isPending: isRestoring } = useRestoreWorkspace();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleCreate = async (data: {
    name: string;
    domain: string;
    description?: string;
    products?: Array<{ id: number; name: string; vendor?: string; version?: string; category: string }>;
  }) => {
    try {
      await createWs({
        data: {
          name: data.name,
          domain: data.domain,
          description: data.description,
          products: data.products?.map((p) => ({
            name: p.name,
            vendor: p.vendor,
            version: p.version,
            category: p.category,
          })),
        },
      });
      refetch();
      setShowCreate(false);
    } catch {
      toast.error("Failed to create workspace. Please try again.");
    }
  };

  const handleDelete = async (ws: WorkspaceCard) => {
    if (!window.confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return;
    try {
      await deleteWs({ id: ws.id });
      refetch();
    } catch {
      toast.error("Failed to delete workspace. Please try again.");
    }
  };

  const handleActivate = (ws: WorkspaceCard) => {
    if (ws.deletedAt) {
      toast.error("Restore this workspace before viewing its feed.");
      return;
    }
    window.dispatchEvent(new CustomEvent("cyfy:select-workspace", { detail: { id: ws.id } }));
    setLocation("/");
  };

  const handleRestore = async (ws: WorkspaceCard) => {
    setRestoringId(ws.id);
    try {
      await restoreWs({ id: ws.id });
      toast.success(`"${ws.name}" has been restored.`);
      refetch();
    } catch {
      toast.error("Failed to restore workspace. Please try again.");
    } finally {
      setRestoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const nonDefaultWorkspaces = workspaces.filter((w) => !w.isDefault);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground mt-1">
            Manage your workspaces and monitor threats relevant to each environment.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
          <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create a workspace to track threats relevant to a specific product stack or domain.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create your first workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
            const card = ws as WorkspaceCard;
            const isDeleted = Boolean(card.deletedAt);
            const daysLeft = daysUntil(card.purgeAfter);
            const busy = restoringId === card.id && isRestoring;
            return (
            <div
              key={card.id}
              className={cn(
                "group relative border rounded-xl p-5 flex flex-col gap-3 transition-colors",
                isDeleted
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {card.isDefault ? (
                    <Globe className="w-5 h-5 shrink-0 text-primary" />
                  ) : (
                    <Building2
                      className={cn(
                        "w-5 h-5 shrink-0 transition-colors",
                        isDeleted
                          ? "text-destructive"
                          : "text-muted-foreground group-hover:text-primary"
                      )}
                    />
                  )}
                  <div className="min-w-0">
                    <h3
                      className={cn(
                        "font-semibold truncate",
                        isDeleted && "line-through text-muted-foreground"
                      )}
                    >
                      {card.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{card.domain}</p>
                  </div>
                </div>
                {card.isDefault && (
                  <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                )}
              </div>

              {card.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{card.description}</p>
              )}

              {card.createdAt && !isDeleted && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created {new Date(card.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </p>
              )}

              {isDeleted && (
                <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {daysLeft === null || daysLeft === 0
                      ? "Scheduled for purge — restore now"
                      : `Purges in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto pt-2">
                {isDeleted ? (
                  <button
                    onClick={() => handleRestore(card)}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5 border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className={cn("w-3.5 h-3.5", busy && "animate-spin")} />
                    {busy ? "Restoring…" : "Restore workspace"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleActivate(card)}
                      className="flex-1 text-sm py-1.5 border border-border/60 hover:border-primary/40 hover:text-primary transition-colors text-center"
                    >
                      View feed
                    </button>
                    {!card.isDefault && (
                      <button
                        onClick={() => handleDelete(card)}
                        className="p-1.5 border border-border/60 hover:border-destructive/50 hover:text-destructive transition-colors"
                        title="Delete workspace"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {nonDefaultWorkspaces.length === 0 && workspaces.length > 0 && (
        <div className="flex items-center gap-3 p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            You only have the default global workspace. Create a custom workspace to track threats
            for a specific product stack.
          </span>
        </div>
      )}

      <CreateWorkspaceModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

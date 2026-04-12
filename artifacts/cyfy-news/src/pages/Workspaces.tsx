import { useState } from "react";
import { Building2, Globe, Plus, Trash2, Star, AlertTriangle } from "lucide-react";
import { useListWorkspaces, useDeleteWorkspace } from "@workspace/api-client-react";
import { CreateWorkspaceModal } from "@/components/Workspace";
import { useCreateWorkspace } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/shared";

interface WorkspaceCard {
  id: string;
  name: string;
  domain: string;
  description?: string | null;
  isDefault?: boolean;
}

export default function Workspaces() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: workspaces = [], isLoading, refetch } = useListWorkspaces();
  const { mutateAsync: createWs } = useCreateWorkspace();
  const { mutateAsync: deleteWs } = useDeleteWorkspace();

  const handleCreate = async (data: {
    name: string;
    domain: string;
    description?: string;
    products?: Array<{ id: number; name: string; vendor?: string; version?: string; category: string }>;
  }) => {
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
  };

  const handleDelete = async (ws: WorkspaceCard) => {
    if (!window.confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return;
    await deleteWs({ id: ws.id });
    refetch();
  };

  const handleActivate = (ws: WorkspaceCard) => {
    window.dispatchEvent(new CustomEvent("cyfy:select-workspace", { detail: { id: ws.id } }));
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
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={cn(
                "group relative border border-border/60 rounded-xl p-5 flex flex-col gap-3 transition-colors bg-card",
                "hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {ws.isDefault ? (
                    <Globe className="w-5 h-5 shrink-0 text-primary" />
                  ) : (
                    <Building2 className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{ws.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{ws.domain}</p>
                  </div>
                </div>
                {ws.isDefault && (
                  <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                )}
              </div>

              {ws.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{ws.description}</p>
              )}

              <div className="flex items-center gap-2 mt-auto pt-2">
                <button
                  onClick={() => handleActivate(ws)}
                  className="flex-1 text-sm py-1.5 border border-border/60 hover:border-primary/40 hover:text-primary transition-colors text-center"
                >
                  View feed
                </button>
                {!ws.isDefault && (
                  <button
                    onClick={() => handleDelete(ws as WorkspaceCard)}
                    className="p-1.5 border border-border/60 hover:border-destructive/50 hover:text-destructive transition-colors"
                    title="Delete workspace"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
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

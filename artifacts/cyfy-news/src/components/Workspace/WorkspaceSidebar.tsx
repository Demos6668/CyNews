import { useState } from "react";
import { Plus, Globe, Building2, Star, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Workspace {
  id: string;
  name: string;
  domain: string;
  description?: string | null;
  isDefault?: boolean;
}

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelect: (ws: Workspace) => void;
  onCreateNew: () => void;
  onDelete?: (ws: Workspace) => void;
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspace,
  onSelect,
  onCreateNew,
  onDelete,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-56 bg-card border-r border-border flex flex-col shrink-0">
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="p-4 border-b border-border flex items-center justify-between w-full hover:bg-white/5 transition-colors text-left"
      >
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Workspaces
        </h2>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && <div className="flex-1 overflow-y-auto p-2">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 transition-colors",
              activeWorkspace?.id === ws.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <button
              onClick={() => onSelect(ws)}
              className="flex-1 flex items-center gap-3 min-w-0 text-left"
            >
              {ws.isDefault ? (
                <Globe className="w-4 h-4 shrink-0" />
              ) : (
                <Building2 className="w-4 h-4 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ws.name}</div>
                {!ws.isDefault && (
                  <div className="text-xs opacity-70 truncate">{ws.domain}</div>
                )}
              </div>
              {ws.isDefault && (
                <Star className="w-3 h-3 shrink-0 text-amber-400" />
              )}
            </button>
            {!ws.isDefault && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete workspace "${ws.name}"?`)) {
                    onDelete(ws);
                  }
                }}
                className={cn(
                  "shrink-0 p-1 rounded opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity",
                  activeWorkspace?.id === ws.id ? "hover:text-primary-foreground" : "hover:text-destructive"
                )}
                title="Delete workspace"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>}

      {!collapsed && (
        <div className="p-4 border-t border-border">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Workspace
          </button>
        </div>
      )}
    </div>
  );
}

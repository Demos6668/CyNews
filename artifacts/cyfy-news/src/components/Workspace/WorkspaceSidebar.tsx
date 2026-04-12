import { useState } from "react";
import { Plus, Globe, Building2, Star, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceSectionKey = "high" | "medium" | "low" | "info" | "resolved";

export interface WorkspaceSectionCounts {
  high: number;
  medium: number;
  low: number;
  info: number;
  resolved: number;
}

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
  activeSection: WorkspaceSectionKey | null;
  sectionCounts: WorkspaceSectionCounts;
  onSelect: (ws: Workspace) => void;
  onSectionSelect: (section: WorkspaceSectionKey) => void;
  onCreateNew: () => void;
  onDelete?: (ws: Workspace) => void;
}

const workspaceSections: Array<{ key: WorkspaceSectionKey; label: string }> = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "info", label: "Info" },
  { key: "resolved", label: "Patch Visibility" },
];

export function WorkspaceSidebar({
  workspaces,
  activeWorkspace,
  activeSection,
  sectionCounts,
  onSelect,
  onSectionSelect,
  onCreateNew,
  onDelete,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-56 bg-background border-r border-border/50 flex flex-col shrink-0">
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="p-4 border-b border-border/50 flex items-center justify-between w-full transition-colors text-left"
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
        {workspaces.map((ws) => {
          const isActiveWorkspace = activeWorkspace?.id === ws.id;

          return (
            <div key={ws.id} className="mb-1">
              <div
                className={cn(
                  "group flex items-center gap-2 px-3 py-2.5 border-l-2 transition-colors",
                  isActiveWorkspace
                    ? "text-primary border-l-primary"
                    : "text-muted-foreground border-l-transparent hover:text-foreground"
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
                      "shrink-0 p-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity",
                      isActiveWorkspace ? "hover:text-primary" : "hover:text-destructive"
                    )}
                    title="Delete workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isActiveWorkspace && !ws.isDefault && (
                <div className="mt-1 ml-5 pl-3 border-l border-border/60 space-y-1">
                  {workspaceSections.map((section) => {
                    const isActiveSection = activeSection === section.key;
                    const count = sectionCounts[section.key];

                    return (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => onSectionSelect(section.key)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-2.5 py-1.5 text-xs transition-colors",
                          isActiveSection
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="truncate">{section.label}</span>
                        <span
                          className={cn(
                            "shrink-0 px-1.5 py-0.5 text-[10px] font-medium",
                            isActiveSection
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {!collapsed && (
        <div className="p-4 border-t border-border">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New workspace
          </button>
        </div>
      )}
    </div>
  );
}

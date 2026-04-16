import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Plus, Trash2, ChevronDown } from "lucide-react";
import { useSessionContext } from "@/context/SessionContext";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedView {
  id: number;
  name: string;
  page: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

interface SavedViewsButtonProps {
  /** The page key used to scope views (e.g. "advisories", "news/local"). */
  page: string;
  /** Current filter state to save. */
  currentFilters: Record<string, unknown>;
  /** Called when user clicks a saved view to restore it. */
  onApplyView: (filters: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchViews(page: string): Promise<SavedView[]> {
  const res = await fetch(`/api/saved-views?page=${encodeURIComponent(page)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load saved views");
  const data = (await res.json()) as { views: SavedView[] };
  return data.views;
}

async function createView(page: string, name: string, filters: Record<string, unknown>): Promise<SavedView> {
  const res = await fetch("/api/saved-views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ page, name, filters }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to save view");
  }
  const data = (await res.json()) as { view: SavedView };
  return data.view;
}

async function deleteView(id: number): Promise<void> {
  const res = await fetch(`/api/saved-views/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete view");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SavedViewsButton({ page, currentFilters, onApplyView }: SavedViewsButtonProps) {
  const { isAuthenticated } = useSessionContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const queryKey = ["saved-views", page];

  const { data: views = [] } = useQuery({
    queryKey,
    queryFn: () => fetchViews(page),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createView(page, name, currentFilters),
    onSuccess: (view) => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success(`View "${view.name}" saved`);
      setSaving(false);
      setViewName("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteView,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSaving(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when save mode opens
  useEffect(() => {
    if (saving) inputRef.current?.focus();
  }, [saving]);

  if (!isAuthenticated) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
        title="Saved views"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Views
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-border bg-card shadow-lg z-50 p-2 space-y-1">
          {views.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                Saved views
              </p>
              {views.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 group rounded-lg hover:bg-muted/30 px-2 py-1.5"
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-sm truncate"
                    onClick={() => { onApplyView(v.filters); setOpen(false); }}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(v.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    title="Delete view"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <hr className="border-border my-1" />
            </>
          )}

          {saving ? (
            <form
              onSubmit={(e) => { e.preventDefault(); if (viewName.trim()) createMutation.mutate(viewName.trim()); }}
              className="px-2 py-1 space-y-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name…"
                maxLength={100}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!viewName.trim() || createMutation.isPending}
                  className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50 hover:bg-primary/90"
                >
                  {createMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSaving(false); setViewName(""); }}
                  className="py-1.5 px-3 rounded-md text-xs text-muted-foreground hover:bg-muted/30"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSaving(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Save current filters…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

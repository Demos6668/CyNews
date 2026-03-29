import { useState, useEffect, useCallback } from "react";
import type { Workspace } from "@/components/Workspace/WorkspaceSidebar";

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const selectDefault = useCallback((list: Workspace[]) => {
    const master = list.find((w) => w.isDefault);
    setActiveWorkspace(master ?? list[0] ?? null);
  }, []);

  const fetchWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  useEffect(() => {
    fetchWorkspaces()
      .then((list) => {
        setWorkspaces(list);
        selectDefault(list);
      })
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [fetchWorkspaces, selectDefault]);

  const deleteWorkspace = useCallback(async (ws: Workspace) => {
    const res = await fetch(`/api/workspaces/${ws.id}`, { method: "DELETE" });
    if (!res.ok) return;
    const updated = await fetchWorkspaces();
    setWorkspaces(updated);
    if (activeWorkspace?.id === ws.id) {
      selectDefault(updated);
    }
  }, [activeWorkspace?.id, fetchWorkspaces, selectDefault]);

  const createWorkspace = useCallback(async (data: {
    name: string;
    domain: string;
    description?: string;
    products?: Array<{ id: number; name: string; vendor?: string; version?: string; category: string }>;
  }) => {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        domain: data.domain,
        description: data.description,
        products: data.products?.map((p) => ({
          name: p.name,
          vendor: p.vendor,
          version: p.version,
          category: p.category,
        })),
      }),
    });
    if (!res.ok) throw new Error("Failed to create workspace");
    const created: Workspace = await res.json();
    const updated = await fetchWorkspaces();
    setWorkspaces(updated.length > 0 ? updated : [...workspaces, created]);
    setActiveWorkspace(created);
    return created;
  }, [fetchWorkspaces, workspaces]);

  return {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    loading,
    deleteWorkspace,
    createWorkspace,
  };
}

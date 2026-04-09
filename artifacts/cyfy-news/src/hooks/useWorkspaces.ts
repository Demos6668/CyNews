import { useState, useEffect, useCallback } from "react";
import {
  listWorkspaces as apiListWorkspaces,
  createWorkspace as apiCreateWorkspace,
  deleteWorkspace as apiDeleteWorkspace,
} from "@workspace/api-client-react";
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
    try {
      const data = await apiListWorkspaces();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
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
    await apiDeleteWorkspace(ws.id);
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
    const created = await apiCreateWorkspace({
      name: data.name,
      domain: data.domain,
      description: data.description,
      products: data.products?.map((p) => ({
        name: p.name,
        vendor: p.vendor,
        version: p.version,
        category: p.category,
      })),
    });
    const updated = await fetchWorkspaces();
    setWorkspaces((current) => updated.length > 0 ? updated : [...current, created]);
    setActiveWorkspace(created);
    return created;
  }, [fetchWorkspaces]);

  return {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    loading,
    deleteWorkspace,
    createWorkspace,
  };
}

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WorkspaceSidebar, CreateWorkspaceModal, WorkspaceFeed } from "@/components/Workspace";
import type { Workspace } from "@/components/Workspace/WorkspaceSidebar";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(Array.isArray(data) ? data : []);
        const master = (Array.isArray(data) ? data : []).find((w) => w.isDefault);
        const first = (Array.isArray(data) ? data : [])[0];
        setActiveWorkspace(master ?? first ?? null);
      })
      .catch(() => setWorkspaces([]));
  }, []);

  const handleDeleteWorkspace = async (ws: Workspace) => {
    const res = await fetch(`/api/workspaces/${ws.id}`, { method: "DELETE" });
    if (!res.ok) return;
    const updated = await fetch("/api/workspaces").then((r) => r.json());
    setWorkspaces(Array.isArray(updated) ? updated : []);
    if (activeWorkspace?.id === ws.id) {
      const master = (Array.isArray(updated) ? updated : []).find((w: Workspace) => w.isDefault);
      const first = (Array.isArray(updated) ? updated : [])[0];
      setActiveWorkspace(master ?? first ?? null);
    }
  };

  const handleCreateWorkspace = async (data: {
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
    const created = await res.json();
    const updated = await fetch("/api/workspaces").then((r) => r.json());
    setWorkspaces(Array.isArray(updated) ? updated : [...workspaces, created]);
    setActiveWorkspace(created);
    setShowCreateModal(false);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background ambient effects */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[500px] bg-accent/10 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('/images/soc-bg.png')] bg-cover bg-center mix-blend-overlay opacity-30" />
      </div>

      <Sidebar />
      <WorkspaceSidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelect={setActiveWorkspace}
        onCreateNew={() => setShowCreateModal(true)}
        onDelete={handleDeleteWorkspace}
      />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pl-16 lg:pl-4 pb-20 sm:pb-4 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeWorkspace?.isDefault ? (
              children
            ) : activeWorkspace ? (
              <WorkspaceFeed workspace={activeWorkspace} />
            ) : (
              children
            )}
          </div>
        </main>
        <Footer />
      </div>
      <BottomNav />
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateWorkspace}
      />
    </div>
  );
}

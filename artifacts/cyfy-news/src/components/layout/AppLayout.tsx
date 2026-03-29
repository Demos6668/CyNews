import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WorkspaceSidebar, CreateWorkspaceModal, WorkspaceFeed } from "@/components/Workspace";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    deleteWorkspace,
    createWorkspace,
  } = useWorkspaces();

  const handleCreateWorkspace = async (data: {
    name: string;
    domain: string;
    description?: string;
    products?: Array<{ id: number; name: string; vendor?: string; version?: string; category: string }>;
  }) => {
    await createWorkspace(data);
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

      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <div
        className={`flex flex-1 min-w-0 transition-[margin] duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-[260px]"}`}
      >
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSelect={setActiveWorkspace}
          onCreateNew={() => setShowCreateModal(true)}
          onDelete={deleteWorkspace}
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

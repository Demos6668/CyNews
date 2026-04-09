import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WorkspaceSidebar, CreateWorkspaceModal, WorkspaceFeed } from "@/components/Workspace";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ReactNode } from "react";
import type { Workspace as SidebarWorkspace, WorkspaceSectionCounts, WorkspaceSectionKey } from "@/components/Workspace/WorkspaceSidebar";

const emptySectionCounts: WorkspaceSectionCounts = {
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  resolved: 0,
};

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<WorkspaceSectionKey | null>(null);
  const [workspaceSectionCounts, setWorkspaceSectionCounts] = useState<WorkspaceSectionCounts>(emptySectionCounts);
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    deleteWorkspace,
    createWorkspace,
  } = useWorkspaces();

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.isDefault) {
      setActiveWorkspaceSection(null);
      setWorkspaceSectionCounts(emptySectionCounts);
      return;
    }

    setActiveWorkspaceSection("high");
  }, [activeWorkspace?.id, activeWorkspace?.isDefault]);

  const handleCreateWorkspace = async (data: {
    name: string;
    domain: string;
    description?: string;
    products?: Array<{ id: number; name: string; vendor?: string; version?: string; category: string }>;
  }) => {
    await createWorkspace(data);
    setShowCreateModal(false);
  };

  const handleSelectWorkspace = (workspace: SidebarWorkspace) => {
    setActiveWorkspace(workspace);
    if (workspace.isDefault) {
      setActiveWorkspaceSection(null);
      return;
    }

    setActiveWorkspaceSection("high");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <div
        className={`flex flex-1 min-w-0 transition-[margin] duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-[260px]"}`}
      >
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          activeSection={activeWorkspaceSection}
          sectionCounts={workspaceSectionCounts}
          onSelect={handleSelectWorkspace}
          onSectionSelect={setActiveWorkspaceSection}
          onCreateNew={() => setShowCreateModal(true)}
          onDelete={deleteWorkspace}
        />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 pl-16 lg:pl-4 pb-20 lg:pb-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              {activeWorkspace?.isDefault ? (
                children
              ) : activeWorkspace ? (
                <WorkspaceFeed
                  workspace={activeWorkspace}
                  selectedSection={activeWorkspaceSection}
                  onSectionCountsChange={setWorkspaceSectionCounts}
                />
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

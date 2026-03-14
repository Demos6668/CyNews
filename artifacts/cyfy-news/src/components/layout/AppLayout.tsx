import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background ambient effects */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[500px] bg-accent/10 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('/images/soc-bg.png')] bg-cover bg-center mix-blend-overlay opacity-30" />
      </div>

      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

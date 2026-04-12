import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Globe,
  MapPin,
  Shield,
  ShieldAlert,
  Crosshair,
  Bookmark,
  Settings,
  Menu,
  ChevronLeft,
  X,
  Wrench,
  Building2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, section: "main" },
  { name: "Local News", href: "/news/local", icon: MapPin, section: "news" },
  { name: "Global News", href: "/news/global", icon: Globe, section: "news" },
  { name: "CERT-In", href: "/cert-in", icon: Shield, section: "intel" },
  { name: "Advisories", href: "/advisories", icon: ShieldAlert, section: "intel" },
  { name: "Patches", href: "/patches", icon: Wrench, section: "intel" },
  { name: "Threat Intel", href: "/threat-intel", icon: Crosshair, section: "intel" },
  { name: "Workspaces", href: "/workspaces", icon: Building2, section: "intel" },
  { name: "Bookmarks", href: "/bookmarks", icon: Bookmark, section: "intel" },
  { name: "Settings", href: "/settings", icon: Settings, section: "settings" },
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        <AnimatePresence>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 overflow-hidden whitespace-nowrap"
            >
              <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="CyNews" className="w-8 h-8 rounded" />
              <span className="font-bold text-xl tracking-wider text-white glow-text">CyNews</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button 
          onClick={() => {
            if (window.innerWidth < 1024) {
              setMobileOpen(false);
            } else {
              onCollapsedChange?.(!collapsed);
            }
          }}
          className={cn("p-2 text-muted-foreground hover:text-white transition-colors", collapsed ? "mx-auto" : "ml-auto")}
        >
          {window.innerWidth < 1024 ? <X size={20} /> : collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2" aria-label="Main navigation">
        {navItems.map((item, idx) => {
          const pathname = location.split("?")[0];
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
          const showDivider =
            !collapsed &&
            idx > 0 &&
            item.section !== navItems[idx - 1].section;

          return (
            <div key={item.href}>
              {showDivider && (
                <div className="my-3 mx-3 border-t border-white/5" />
              )}
              <Link href={item.href} className="block" aria-current={isActive ? "page" : undefined}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 border-l-2 transition-all duration-200 group cursor-pointer",
                    isActive
                      ? "text-white border-l-primary"
                      : "text-muted-foreground hover:text-white border-l-transparent"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon
                    size={20}
                    className={cn(
                      "flex-shrink-0 transition-transform duration-300",
                      isActive ? "text-white scale-110" : "group-hover:scale-110"
                    )}
                  />
                  {!collapsed && (
                    <span className="font-medium truncate">{item.name}</span>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-2 z-50 p-2 text-muted-foreground hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px] bg-background border-r border-border/50 flex flex-col transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <motion.aside 
        animate={{ width: collapsed ? 80 : 260 }}
        className="hidden lg:flex fixed top-0 left-0 h-screen bg-background border-r border-border/50 flex-col z-40"
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}

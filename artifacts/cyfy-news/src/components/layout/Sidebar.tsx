import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Globe, 
  MapPin, 
  Shield,
  ShieldAlert, 
  Crosshair, 
  Settings,
  Menu,
  ChevronLeft,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, section: "main" },
  { name: "Local News", href: "/news/local", icon: MapPin, section: "news" },
  { name: "Global News", href: "/news/global", icon: Globe, section: "news" },
  { name: "CERT-In", href: "/cert-in", icon: Shield, section: "intel" },
  { name: "Advisories", href: "/advisories", icon: ShieldAlert, section: "intel" },
  { name: "Threat Intel", href: "/threat-intel", icon: Crosshair, section: "intel" },
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
              <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="CYFY" className="w-8 h-8 rounded" />
              <span className="font-bold text-xl tracking-wider text-white glow-text">CYFY</span>
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
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors ml-auto"
        >
          {window.innerWidth < 1024 ? <X size={20} /> : collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2" aria-label="Main navigation">
        {navItems.map((item, idx) => {
          const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/');
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
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer",
                    isActive
                      ? "bg-primary text-white border border-primary shadow-[0_0_15px_rgba(0,149,175,0.3)]"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white hover:shadow-[0_0_12px_rgba(0,149,175,0.15)] border border-transparent"
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-white transition-colors"
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
          "lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px] bg-secondary border-r border-border flex flex-col shadow-2xl transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <motion.aside 
        animate={{ width: collapsed ? 80 : 260 }}
        className="hidden lg:flex fixed top-0 left-0 h-screen bg-secondary border-r border-border flex-col z-40 shadow-2xl"
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}

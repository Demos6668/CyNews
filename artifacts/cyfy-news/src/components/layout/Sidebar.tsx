import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Globe, 
  MapPin, 
  ShieldAlert, 
  Crosshair, 
  Settings,
  Menu,
  ChevronLeft
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Local News", href: "/news/local", icon: MapPin },
  { name: "Global News", href: "/news/global", icon: Globe },
  { name: "Advisories", href: "/advisories", icon: ShieldAlert },
  { name: "Threat Intel", href: "/threat-intel", icon: Crosshair },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside 
      animate={{ width: collapsed ? 80 : 260 }}
      className="h-screen sticky top-0 bg-secondary border-r border-border flex flex-col z-40 shadow-2xl"
    >
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
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors ml-auto"
        >
          {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/');
          
          return (
            <Link key={item.href} href={item.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(0,149,175,0.15)]" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon size={20} className={cn(
                  "flex-shrink-0 transition-transform duration-300", 
                  isActive ? "text-primary scale-110" : "group-hover:scale-110"
                )} />
                {!collapsed && (
                  <span className="font-medium truncate">{item.name}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
      
      {!collapsed && (
        <div className="p-4 border-t border-white/5">
          <div className="bg-background/50 rounded-xl p-4 border border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">SOC ACTIVE</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 relative z-10">System operational</p>
          </div>
        </div>
      )}
    </motion.aside>
  );
}

import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Globe,
  MapPin,
  Shield,
  ShieldAlert,
  Crosshair,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Local", href: "/news/local", icon: MapPin },
  { name: "Global", href: "/news/global", icon: Globe },
  { name: "CERT-In", href: "/cert-in", icon: Shield },
  { name: "Advisories", href: "/advisories", icon: ShieldAlert },
  { name: "Patches", href: "/patches", icon: Wrench },
  { name: "Threats", href: "/threat-intel", icon: Crosshair },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      aria-label="Bottom navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--dark-navy)] border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <div className="flex items-center justify-around h-[56px]">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));

          return (
            <Link key={item.href} href={item.href} className="flex-1 h-full" aria-current={isActive ? "page" : undefined}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center min-h-[44px] h-full gap-0.5 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_var(--primary)]")} />
                <span className="text-[9px] font-medium tracking-wide">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Globe,
  MapPin,
  ShieldAlert,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Local", href: "/news/local", icon: MapPin },
  { name: "Global", href: "/news/global", icon: Globe },
  { name: "Advisories", href: "/advisories", icon: ShieldAlert },
  { name: "Threats", href: "/threat-intel", icon: Crosshair },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--dark-navy)] border-t border-border safe-area-pb"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));

          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full gap-1 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

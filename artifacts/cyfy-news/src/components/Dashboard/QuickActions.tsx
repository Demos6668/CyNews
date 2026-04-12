import { useLocation } from "wouter";
import { MapPin, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  const [location, setLocation] = useLocation();
  const scope: "local" | "global" | null =
    location === "/news/local" ? "local" : location === "/news/global" ? "global" : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-1 rounded-full border border-primary/30 bg-secondary/50",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setLocation("/news/local")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
          scope === "local"
            ? "bg-primary text-white"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        )}
      >
        <MapPin className="h-4 w-4" />
        Local
      </button>
      <button
        type="button"
        onClick={() => setLocation("/news/global")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
          scope === "global"
            ? "bg-primary text-white"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        )}
      >
        <Globe className="h-4 w-4" />
        Global
      </button>
    </div>
  );
}

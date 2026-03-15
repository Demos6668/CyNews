import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span>CYFY News Board v1.0</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Internal Use Only</span>
        <span className="hidden sm:inline">SOC Active</span>
      </div>
    </footer>
  );
}

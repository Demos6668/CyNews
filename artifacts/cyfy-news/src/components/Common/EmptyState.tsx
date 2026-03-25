import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title = "No results found",
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 px-6 text-center",
        "rounded-xl border border-dashed border-border bg-card/30",
        className
      )}
    >
      {Icon && (
        <Icon className="h-12 w-12 text-muted-foreground mb-4 opacity-60" />
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button variant="link" className="text-primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  /** Right-side actions bar */
  actions?: ReactNode;
  /** Optional small meta badge (e.g. "247 results") shown next to the title */
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  icon: Icon,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
            {meta && (
              <span className="text-xs font-mono text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full">
                {meta}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

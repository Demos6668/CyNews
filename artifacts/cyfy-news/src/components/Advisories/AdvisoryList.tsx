import { AdvisoryCard } from "./AdvisoryCard";
import type { Advisory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface AdvisoryListProps {
  items: Advisory[];
  onItemClick?: (item: Advisory) => void;
  className?: string;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  showCheckboxes?: boolean;
  /** Index of the keyboard-focused item (j/k navigation). */
  focusedIndex?: number;
}

export function AdvisoryList({
  items,
  onItemClick,
  className,
  selectedIds,
  onToggleSelect,
  showCheckboxes,
  focusedIndex,
}: AdvisoryListProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6",
        className
      )}
    >
      {items.map((item, idx) => (
        <AdvisoryCard
          key={item.id}
          item={item}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
          selected={selectedIds?.has(item.id)}
          onToggleSelect={onToggleSelect}
          showCheckbox={showCheckboxes}
          focused={focusedIndex === idx}
        />
      ))}
    </div>
  );
}

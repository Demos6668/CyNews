import { NewsCard } from "./NewsCard";
import type { NewsItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface NewsListProps {
  items: NewsItem[];
  onItemClick?: (item: NewsItem) => void;
  className?: string;
}

export function NewsList({ items, onItemClick, className }: NewsListProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        className
      )}
    >
      {items.map((item) => (
        <NewsCard
          key={item.id}
          item={item}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        />
      ))}
    </div>
  );
}

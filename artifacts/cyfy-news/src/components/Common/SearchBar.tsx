import { Search } from "lucide-react";
import { Input } from "@/components/ui/shared";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search global threats, CVEs, news...",
  className,
  inputRef,
}: SearchBarProps) {
  return (
    <div className={cn("relative group flex-1 max-w-xl", className)} role="search">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-accent transition-colors" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        aria-label="Search"
        className="pl-10 bg-secondary/50 border-white/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent rounded-full h-10 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

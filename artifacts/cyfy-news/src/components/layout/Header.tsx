import { Search, Bell, User, Loader2 } from "lucide-react";
import { Input, Button } from "@/components/ui/shared";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";

export function Header() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    if (debouncedSearch) {
      setLocation(`/search?q=${encodeURIComponent(debouncedSearch)}`);
    }
  }, [debouncedSearch, setLocation]);

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-30">
      <div className="flex-1 max-w-xl relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-accent transition-colors" />
        <Input 
          placeholder="Search global threats, CVEs, news..." 
          className="pl-10 bg-secondary/50 border-white/10 focus-visible:ring-accent focus-visible:border-accent rounded-full h-10 w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4 ml-4">
        <button className="relative p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-secondary">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-background"></span>
        </button>
        
        <div className="h-8 w-px bg-border mx-2" />
        
        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-secondary font-bold text-sm">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium hidden sm:inline-block">Analyst</span>
        </button>
      </div>
    </header>
  );
}

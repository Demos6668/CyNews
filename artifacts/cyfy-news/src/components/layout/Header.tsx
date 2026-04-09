import { Bell, User, ChevronDown, LogOut, Settings, Search, X } from "lucide-react";
import { SearchBar } from "@/components/Common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function Header() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const { data: stats } = useGetDashboardStats(undefined, {
    query: { queryKey: getGetDashboardStatsQueryKey(), refetchInterval: 60000 },
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus search input whenever mobile overlay opens
  useEffect(() => {
    if (mobileSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [mobileSearchOpen]);

  useKeyboardShortcuts({
    onSearchFocus: () => setMobileSearchOpen(true),
  });

  useEffect(() => {
    if (debouncedSearch) {
      setLocation(`/search?q=${encodeURIComponent(debouncedSearch)}`);
      setSearchQuery("");
      setMobileSearchOpen(false);
    }
  }, [debouncedSearch, setLocation]);

  const criticalCount = stats?.criticalAlerts ?? 0;

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 backdrop-blur-md border-b border-border sticky top-0 z-30"
      style={{ backgroundColor: "var(--dark-navy)" }}
      aria-label="Site header"
    >
      {/* Mobile: fullscreen search overlay */}
      {mobileSearchOpen && (
        <div className="lg:hidden absolute inset-0 z-50 flex items-center gap-2 px-4 bg-[var(--dark-navy)] border-b border-border">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search threats, CVEs, news..."
            inputRef={searchInputRef}
            autoFocus
          />
          <button
            onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Desktop search — always visible on lg+ */}
      <div className="hidden lg:block flex-1 max-w-xl">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search global threats, CVEs, news..."
          inputRef={searchInputRef}
        />
      </div>

      <div className="flex items-center gap-3 ml-auto lg:ml-4">
        {/* Mobile search toggle */}
        <button
          className="lg:hidden p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Search"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          className="relative p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Notifications"
          title={criticalCount > 0 ? `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""} — click to view` : "Notifications — coming soon"}
          onClick={() => {
            if (criticalCount > 0) {
              setLocation("/advisories?severity=critical");
            }
          }}
        >
          <Bell className="h-5 w-5" />
          {criticalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-[var(--dark-navy)]">
              {criticalCount > 99 ? "99+" : criticalCount}
            </span>
          )}
        </button>

        <div className="h-8 w-px bg-border mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity rounded-lg px-2 py-1.5 hover:bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-secondary font-bold text-sm">
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium hidden sm:inline-block">
                Analyst
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out (coming soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

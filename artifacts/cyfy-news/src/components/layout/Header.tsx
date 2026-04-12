import { Bell, User, ChevronDown, LogOut, Settings, Search, X, History, AlertTriangle } from "lucide-react";
import { SearchBar } from "@/components/Common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSeverityBadgeColors, formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePreference } from "@/hooks/usePreferences";

export function Header() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const { data: stats } = useGetDashboardStats(undefined, {
    query: { queryKey: getGetDashboardStatsQueryKey(), refetchInterval: 60000 },
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [profileName] = usePreference("profileName");

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
          className="p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Recently viewed"
          title="Recently viewed"
          onClick={() => window.dispatchEvent(new Event("cyfy:open-history"))}
        >
          <History className="h-5 w-5" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {criticalCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-[var(--dark-navy)]">
                  {criticalCount > 99 ? "99+" : criticalCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 border-border/60">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <span className="text-sm font-semibold">Recent Activity</span>
              {criticalCount > 0 && (
                <span className="text-xs text-destructive font-medium">{criticalCount} critical</span>
              )}
            </div>
            {(stats?.recentActivity ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
                {(stats?.recentActivity ?? []).slice(0, 7).map((item) => (
                  <button
                    key={`${item.id}-${item.type}`}
                    type="button"
                    onClick={() => {
                      const route = item.type === "threat" || item.sourceType === "threat"
                        ? `/threat-intel?open=${item.id}&timeframe=all`
                        : `/advisories?open=${item.id}`;
                      setLocation(route);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {(item.severity === "critical" || item.severity === "high") && (
                        <AlertTriangle className={cn(
                          "h-3 w-3 shrink-0",
                          item.severity === "critical" ? "text-destructive" : "text-warning"
                        )} />
                      )}
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        getSeverityBadgeColors(item.severity)
                      )}>
                        {item.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {formatRelative(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2 leading-relaxed">{item.title}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="px-4 py-2.5 border-t border-border/60">
              <button
                type="button"
                onClick={() => setLocation("/advisories")}
                className="text-xs text-primary hover:underline"
              >
                View all advisories →
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-8 w-px bg-border mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity rounded-lg px-2 py-1.5 hover:bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-secondary font-bold text-sm">
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium hidden sm:inline-block truncate max-w-[120px]">
                {profileName}
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

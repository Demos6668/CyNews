import { useSearch } from "@workspace/api-client-react";
import { useSearch as useWouterSearch } from "wouter";
import { Card, Badge, Skeleton } from "@/components/ui/shared";
import { getSeverityBadgeColors, formatDate, stripHtml } from "@/lib/utils";
import { Search as SearchIcon, ChevronRight, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { highlightMatch } from "@/lib/highlightMatch";
import { cn } from "@/lib/utils";

type ResultType = "all" | "news" | "advisory" | "threat";

const TYPE_FILTERS: { label: string; value: ResultType }[] = [
  { label: "All", value: "all" },
  { label: "Advisories", value: "advisory" },
  { label: "Threats", value: "threat" },
  { label: "News", value: "news" },
];

function getResultPath(result: { type: string; id: number }): string {
  switch (result.type) {
    case "news":      return `/news/global?open=${result.id}`;
    case "advisory":  return `/advisories?open=${result.id}`;
    case "threat":    return `/threat-intel?open=${result.id}`;
    default:          return "/";
  }
}

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = highlightMatch(text, query);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-primary/20 text-primary rounded-sm px-0.5 not-italic font-medium"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}

export default function Search() {
  const [, setLocation] = useLocation();
  const searchString = useWouterSearch();
  const query = new URLSearchParams(searchString).get("q") || "";
  const [typeFilter, setTypeFilter] = useState<ResultType>("all");

  const searchParams = { q: query };
  const { data, isLoading, isError, error } = useSearch(searchParams, {
    query: {
      enabled: query.length > 0,
      queryKey: ["/api/search", searchParams],
    },
  });

  const filteredResults = useMemo(() => {
    const all = data?.results ?? [];
    if (typeFilter === "all") return all;
    return all.filter((r) => r.type === typeFilter);
  }, [data?.results, typeFilter]);

  const countByType = useMemo(() => {
    const all = data?.results ?? [];
    return {
      all: all.length,
      advisory: all.filter((r) => r.type === "advisory").length,
      threat: all.filter((r) => r.type === "threat").length,
      news: all.filter((r) => r.type === "news").length,
    };
  }, [data?.results]);

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <SearchIcon className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Search Threats</h2>
        <p className="text-muted-foreground max-w-md">
          Type in the search bar above to find specific threats, CVEs, or intelligence reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-sans">
          Results for <span className="text-primary">"{query}"</span>
        </h1>
        {!isLoading && !isError && (
          <span className="text-sm text-muted-foreground">
            {countByType.all} result{countByType.all !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Type filter chips */}
      {!isLoading && !isError && countByType.all > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {TYPE_FILTERS.map(({ label, value }) => {
            const count = countByType[value];
            const active = typeFilter === value;
            return (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  active
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn("ml-1.5 text-xs", active ? "text-primary/70" : "text-muted-foreground/60")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isError ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Search failed</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-xl border border-white/5">
          <p className="text-lg text-muted-foreground">
            {typeFilter === "all"
              ? "No matches found. Try adjusting your keywords."
              : `No ${typeFilter} results. Try a different filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((result) => (
            <Card
              key={`${result.type}-${result.id}`}
              className="hover:bg-white/5 transition-colors group cursor-pointer border-white/5"
              onClick={() => setLocation(getResultPath(result))}
            >
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase bg-background shrink-0">
                      {result.type}
                    </Badge>
                    <Badge className={getSeverityBadgeColors(result.severity)}>
                      {result.severity?.toUpperCase() ?? "INFO"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(result.publishedAt)}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                    <HighlightedText text={result.title} query={query} />
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <HighlightedText text={stripHtml(result.summary ?? "")} query={query} />
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

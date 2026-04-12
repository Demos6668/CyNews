import { useSearch } from "@workspace/api-client-react";
import { useSearch as useWouterSearch } from "wouter";
import { Card, Badge, Skeleton } from "@/components/ui/shared";
import { getSeverityBadgeColors, formatDate, stripHtml } from "@/lib/utils";
import { Search as SearchIcon, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { highlightMatch } from "@/lib/highlightMatch";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function getAgeLabel(publishedAt: string): string | null {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  if (ageMs < MS_PER_YEAR) return null;
  const years = Math.floor(ageMs / MS_PER_YEAR);
  return years === 1 ? "1 year old" : `${years} years old`;
}

function cleanSummary(summary: string | undefined | null): string {
  const text = stripHtml(summary ?? "").trim();
  if (/^information published\.?$/i.test(text)) return "";
  return text;
}

type ResultType = "all" | "news" | "advisory" | "threat";

const TYPE_FILTERS: { label: string; value: ResultType }[] = [
  { label: "All", value: "all" },
  { label: "Advisories", value: "advisory" },
  { label: "Threats", value: "threat" },
  { label: "News", value: "news" },
];

function getResultPath(result: { type: string; id: number; scope?: string }): string {
  switch (result.type) {
    case "news": {
      // Use scope from the search result; fall back to "global" for non-local items.
      // Also set timeframe=all so the destination page will find the item regardless of age.
      const newsScope = result.scope === "local" ? "local" : "global";
      return `/news/${newsScope}?open=${result.id}&timeframe=all`;
    }
    case "advisory":  return `/advisories?open=${result.id}&timeframe=all`;
    case "threat":    return `/threat-intel?open=${result.id}&timeframe=all`;
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
  const urlParams = new URLSearchParams(searchString);
  const query = urlParams.get("q") || "";
  const scopeParam = urlParams.get("scope");
  const scope = scopeParam === "local" || scopeParam === "global" ? scopeParam : undefined;
  const typeFromUrl = urlParams.get("type") as ResultType;
  const typeFilter: ResultType = (["all", "news", "advisory", "threat"] as ResultType[]).includes(typeFromUrl) ? typeFromUrl : "all";
  usePageTitle(query ? `Search: ${query}` : "Search");
  const [displayLimit, setDisplayLimit] = useState(10);

  // Reset display limit when query or filter changes
  useEffect(() => { setDisplayLimit(10); }, [query, typeFilter]);

  const searchParams = scope ? { q: query, scope } : { q: query };
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
            {countByType.all >= 20
              ? `Showing top ${countByType.all} results`
              : `${countByType.all} result${countByType.all !== 1 ? "s" : ""}`}
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
                onClick={() => {
                  const params = new URLSearchParams(searchString);
                  if (value === "all") { params.delete("type"); } else { params.set("type", value); }
                  setLocation(`/search?${params.toString()}`);
                }}
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
          {filteredResults.slice(0, displayLimit).map((result) => (
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
                    {(() => {
                      const ageLabel = getAgeLabel(result.publishedAt);
                      return ageLabel ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          <Clock className="h-2.5 w-2.5" />
                          {ageLabel}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                    <HighlightedText text={result.title} query={query} />
                  </h3>
                  {(() => {
                    const summary = cleanSummary(result.summary);
                    return summary ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        <HighlightedText text={summary} query={query} />
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 italic">Details pending NVD processing</p>
                    );
                  })()}
                </div>
                <ChevronRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Card>
          ))}
          {filteredResults.length > displayLimit && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setDisplayLimit((prev) => prev + 10)}
                className="px-6 py-2 text-sm border border-border/60 rounded-md hover:border-primary/40 hover:text-primary transition-colors"
              >
                Load more ({filteredResults.length - displayLimit} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

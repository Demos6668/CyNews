import { useSearch } from "@workspace/api-client-react";
import { useSearch as useWouterSearch } from "wouter";
import { Card, Badge, Skeleton } from "@/components/ui/shared";
import { getSeverityBadgeColors, formatDate } from "@/lib/utils";
import { Search as SearchIcon, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function Search() {
  const searchString = useWouterSearch();
  const query = new URLSearchParams(searchString).get("q") || "";
  
  const { data, isLoading } = useSearch({ q: query }, { query: { enabled: query.length > 0 } });

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <SearchIcon className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Search the SOC</h2>
        <p className="text-muted-foreground max-w-md">Type in the search bar above to find specific threats, CVEs, or intelligence reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <h1 className="text-2xl font-bold font-sans">
        Search results for <span className="text-primary">"{query}"</span>
      </h1>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-xl border border-white/5">
          <p className="text-lg text-muted-foreground">No matches found. Try adjusting your keywords.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.results.map(result => (
            <Card key={result.id} className="hover:bg-white/5 transition-colors group cursor-pointer border-white/5">
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase bg-background">{result.type}</Badge>
                    <Badge className={getSeverityBadgeColors(result.severity)}>{result.severity.toUpperCase()}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(result.publishedAt)}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{result.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{result.summary}</p>
                </div>
                <ChevronRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-4" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

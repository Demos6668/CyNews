import { Bookmark, ExternalLink, Calendar, ShieldAlert, Target } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui/shared";
import { cn, formatDate, getSeverityColors, getSeverityBadgeColors, formatRelative } from "@/lib/utils";
import type { NewsItem, Advisory } from "@workspace/api-client-react";
import { useToggleBookmark } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

export function NewsCard({ item, onClick }: { item: NewsItem, onClick?: () => void }) {
  const queryClient = useQueryClient();
  const toggleBookmarkMutation = useToggleBookmark({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      }
    }
  });

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmarkMutation.mutate({ id: item.id });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card 
        onClick={onClick}
        className={cn(
          "h-full overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-xl group",
          "border-border/50 bg-card/60 backdrop-blur-sm",
          getSeverityColors(item.severity)
        )}
      >
        <div className="p-5 flex flex-col h-full bg-gradient-to-br from-transparent to-background/50">
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge className={getSeverityBadgeColors(item.severity)}>
                {item.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-muted-foreground bg-background/50">
                {item.category}
              </Badge>
              {item.scope === 'local' && (
                <Badge variant="secondary" className="bg-primary/20 text-primary">LOCAL</Badge>
              )}
            </div>
            <button 
              onClick={handleBookmark}
              disabled={toggleBookmarkMutation.isPending}
              className="text-muted-foreground hover:text-accent transition-colors p-1 rounded-full hover:bg-white/5"
            >
              <Bookmark className={cn("h-5 w-5", item.bookmarked && "fill-accent text-accent")} />
            </button>
          </div>
          
          <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
          </h3>
          
          <p className="text-muted-foreground text-sm flex-grow line-clamp-3 mb-4">
            {item.summary}
          </p>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatRelative(item.publishedAt)}</span>
            </div>
            <span className="font-mono text-[10px] opacity-70 bg-background px-2 py-0.5 rounded">{item.source}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function AdvisoryCard({ item, onClick }: { item: Advisory, onClick?: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card 
        onClick={onClick}
        className={cn(
          "h-full overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-xl group",
          "border-border/50 bg-card/60 backdrop-blur-sm",
          getSeverityColors(item.severity)
        )}
      >
        <div className="p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-background border border-white/10 shrink-0 font-mono text-lg font-bold shadow-inner">
                {item.cvssScore.toFixed(1)}
              </div>
              <div>
                <div className="text-sm font-mono text-muted-foreground mb-1">{item.cveId}</div>
                <Badge className={getSeverityBadgeColors(item.severity)}>
                  {item.severity.toUpperCase()}
                </Badge>
              </div>
            </div>
            <Badge variant="outline" className="border-white/10 uppercase text-[10px] tracking-wider">
              {item.status.replace('_', ' ')}
            </Badge>
          </div>
          
          <h3 className="font-bold text-[17px] leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
          </h3>
          
          <div className="space-y-2 mt-auto">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
              <span className="line-clamp-1 text-xs">Affects: {item.vendor} {item.affectedProducts[0]} {item.affectedProducts.length > 1 && `+${item.affectedProducts.length - 1}`}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs pt-4 mt-4 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(item.publishedAt)}</span>
              </div>
              {item.patchAvailable ? (
                <span className="text-success flex items-center gap-1 font-medium"><ShieldAlert className="h-3.5 w-3.5"/> Patch Avail</span>
              ) : (
                <span className="text-warning flex items-center gap-1 font-medium"><ShieldAlert className="h-3.5 w-3.5"/> No Patch</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function DetailModal({ item, isOpen, onClose }: { item: NewsItem | Advisory | null, isOpen: boolean, onClose: () => void }) {
  if (!item) return null;

  const isAdvisory = 'cveId' in item;

  return (
    <div className={cn("fixed inset-0 z-50 transition-all duration-300", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border/50 shadow-2xl overflow-y-auto custom-scrollbar transition-transform duration-500 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className={cn("h-2 w-full", getSeverityColors(item.severity).split(' ')[0])} />
        
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Badge className={getSeverityBadgeColors(item.severity)}>{item.severity.toUpperCase()}</Badge>
              {!isAdvisory && <Badge variant="outline">{item.category}</Badge>}
              {isAdvisory && <Badge variant="outline">{(item as Advisory).status.replace('_', ' ')}</Badge>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
          </div>

          <h2 className="text-3xl font-bold mb-4 font-sans leading-tight">{item.title}</h2>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 border-b border-white/10 pb-6">
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4"/> {formatDate(item.publishedAt)}</span>
            {isAdvisory ? (
              <span className="font-mono text-accent">{(item as Advisory).cveId}</span>
            ) : (
              <span className="flex items-center gap-1.5"><ExternalLink className="h-4 w-4"/> {(item as NewsItem).source}</span>
            )}
          </div>

          {isAdvisory ? (
            <div className="space-y-8">
              <div className="flex items-center gap-4 p-4 bg-background/50 rounded-xl border border-white/5">
                <div className="text-center px-4 border-r border-white/10">
                  <div className="text-3xl font-mono font-bold text-white">{(item as Advisory).cvssScore}</div>
                  <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">CVSS</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">Affected Vendor: <span className="text-white">{(item as Advisory).vendor}</span></div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-1">
                    {(item as Advisory).affectedProducts.map((p: string) => <span key={p} className="bg-secondary px-2 py-0.5 rounded text-xs">{p}</span>)}
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{(item as Advisory).description}</p>
              </div>

              {((item as Advisory).workarounds?.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-accent border-b border-border pb-2">Mitigation / Workarounds</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    {(item as Advisory).workarounds.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">Summary</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">{(item as NewsItem).summary}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">Full Report</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{(item as NewsItem).content}</p>
              </div>
              
              {((item as NewsItem).iocs && (item as NewsItem).iocs!.length > 0) && (
                <div className="bg-background rounded-xl border border-destructive/20 p-5">
                  <h3 className="text-sm font-mono text-destructive mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Target className="h-4 w-4"/> Indicators of Compromise (IOCs)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(item as NewsItem).iocs!.map((ioc: string) => (
                      <code key={ioc} className="text-xs bg-destructive/10 text-destructive-foreground px-2 py-1 rounded select-all border border-destructive/20">{ioc}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

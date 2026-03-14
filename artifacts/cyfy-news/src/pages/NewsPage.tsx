import { useGetNews } from "@workspace/api-client-react";
import { NewsCard, DetailModal } from "@/components/shared/ItemCards";
import { Skeleton, Input, Button } from "@/components/ui/shared";
import { useState } from "react";
import { useLocation } from "wouter";
import { Filter, SlidersHorizontal } from "lucide-react";
import type { NewsItem, GetNewsScope } from "@workspace/api-client-react";

export default function NewsPage({ scope }: { scope: GetNewsScope }) {
  const [location, setLocation] = useLocation();
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  
  const { data, isLoading } = useGetNews({ scope, limit: 20 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight capitalize">{scope} News & Threats</h1>
          <p className="text-muted-foreground mt-1">Latest cybersecurity intelligence and events.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg border border-border">
          <Button 
            variant={scope === 'local' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setLocation('/news/local')}
            className="rounded-md w-24"
          >
            Local
          </Button>
          <Button 
            variant={scope === 'global' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setLocation('/news/global')}
            className="rounded-md w-24"
          >
            Global
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Button variant="outline" className="gap-2">
          <Filter size={16} /> Filter by Severity
        </Button>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal size={16} /> Categories
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No news items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data?.items.map(item => (
            <NewsCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
          ))}
        </div>
      )}

      <DetailModal 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
    </div>
  );
}

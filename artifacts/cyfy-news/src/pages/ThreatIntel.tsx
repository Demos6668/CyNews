import { useGetNews } from "@workspace/api-client-react";
import { NewsCard, DetailModal } from "@/components/shared/ItemCards";
import { Skeleton, Button, Card, CardContent } from "@/components/ui/shared";
import { useState } from "react";
import { Crosshair, Download, Terminal, Network } from "lucide-react";
import type { NewsItem } from "@workspace/api-client-react/src/generated/api.schemas";

export default function ThreatIntel() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  // Fetching news filtered by type='threat'
  const { data, isLoading } = useGetNews({ type: 'threat', limit: 20 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3 glow-text">
            <Crosshair className="h-8 w-8 text-destructive" /> Threat Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">Deep dive into actor profiles, TTPs, and campaign tracking.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download size={16} /> JSON
          </Button>
          <Button className="gap-2 bg-destructive hover:bg-destructive/90 text-white border-none">
            <Download size={16} /> Export STIX
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-white/5 backdrop-blur">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Terminal className="text-primary h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Active Campaigns</h3>
              <p className="text-sm text-muted-foreground">Tracking 14 active sophisticated threat campaigns targeting financial sectors globally.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5 backdrop-blur">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
              <Network className="text-accent h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">New IOCs Identified</h3>
              <p className="text-sm text-muted-foreground">Over 3,420 new IP addresses and domain hashes added to blocklists in the last 48h.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4 border-l-4 border-primary pl-3">Latest Threat Reports</h2>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No threat reports available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

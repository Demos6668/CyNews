import { useGetAdvisories } from "@workspace/api-client-react";
import { AdvisoryCard, DetailModal } from "@/components/shared/ItemCards";
import { Skeleton, Button } from "@/components/ui/shared";
import { useState } from "react";
import { ShieldAlert, Download } from "lucide-react";
import type { Advisory } from "@workspace/api-client-react";

export default function Advisories() {
  const [selectedItem, setSelectedItem] = useState<Advisory | null>(null);
  const { data, isLoading } = useGetAdvisories({ limit: 20 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" /> Security Advisories
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage CVEs, patches, and vulnerabilities.</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0">
          <Download size={16} /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No advisories found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data?.items.map(item => (
            <AdvisoryCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
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

import { useGetCertInAdvisories } from "@workspace/api-client-react";
import { AdvisoryDetail, CertInAdvisoryCard } from "@/components/Advisories";
import { Skeleton, Button } from "@/components/ui/shared";
import { TimeframeSelector, Pagination, type TimeframeValue } from "@/components/Common";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { ShieldAlert, Download, ExternalLink, RefreshCw, ChevronDown, Mail, FileDown } from "lucide-react";
import type { Advisory } from "@workspace/api-client-react";
import { EmptyState } from "@/components/Common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkEmailExportModal } from "@/components/Export";
import { useFilterParamsSync, getInitialFiltersFromUrl } from "@/hooks/useFilterParams";
import { exportAdvisoriesBulk } from "@/lib/exportApi";

export default function CertInAdvisories() {
  const searchString = useSearch();
  const [selectedItem, setSelectedItem] = useState<Advisory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEmailExportOpen, setBulkEmailExportOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    const initial = getInitialFiltersFromUrl(searchString);
    if (initial.timeframe) setTimeframe(initial.timeframe as TimeframeValue);
    if (initial.page) setPage(initial.page);
    if (initial.limit) setLimit(initial.limit);
  }, [searchString]);

  useFilterParamsSync(
    "/cert-in",
    { timeframe, page, limit },
    { skipInitialSync: true }
  );

  const skipPageResetRef = useRef(true);
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [timeframe]);

  const certInTimeframe = timeframe === "all" ? "90d" : timeframe;
  const { data: certInData, isLoading: certInLoading } = useGetCertInAdvisories({
    timeframe: certInTimeframe,
    page,
    limit,
  });

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleItemsPerPageChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const totalPages = certInData?.pagination?.totalPages ?? 0;
  const totalItems = certInData?.pagination?.total ?? 0;

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return;
    const blob = await exportAdvisoriesBulk({ ids: Array.from(selectedIds) });
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cert-in-advisories-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
    setSelectedIds(new Set());
  };

  const handleExportAll = async () => {
    const blob = await exportAdvisoriesBulk({ timeframe: certInTimeframe, vendor: "CERT-In" });
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cert-in-advisories-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
              <span className="text-lg font-bold">IN</span>
            </div>
            CERT-In Advisories
          </h1>
          <p className="text-muted-foreground mt-1">
            Indian Computer Emergency Response Team - Official vulnerability notes and advisories
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleExportAll}>
            <Download className="h-4 w-4" />
            Export All ({timeframe})
          </Button>
          <a
            href="https://www.cert-in.org.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            <span>Visit CERT-In</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      <section className="rounded-xl overflow-hidden border-2 border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-card to-card">
        <div className="px-6 py-4 border-b border-orange-500/20 bg-gradient-to-r from-orange-500/20 to-transparent">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{certInData?.pagination?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">
                  {certInData?.pagination?.totalCritical ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {certInData?.pagination?.totalHigh ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">High</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          {certInLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
              <span className="ml-3 text-muted-foreground">Loading CERT-In advisories...</span>
            </div>
          ) : (certInData?.data?.length ?? 0) === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <EmptyState
                title="No CERT-In advisories"
                description="No advisories in the selected timeframe. Try a different time range."
              />
            </div>
          ) : (
            <div className="space-y-4">
              {(certInData?.data ?? []).map((advisory) => (
                <CertInAdvisoryCard
                  key={advisory.id}
                  advisory={advisory}
                  onClick={() => setSelectedItem(advisory)}
                  selected={selectedIds.has(advisory.id)}
                  onToggleSelect={toggleSelect}
                  showCheckbox
                />
              ))}
              {totalPages > 1 && (
                <div className="pt-6">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={limit}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <AdvisoryDetail
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <BulkEmailExportModal
        advisoryIds={Array.from(selectedIds)}
        isCertIn={true}
        isOpen={bulkEmailExportOpen}
        onClose={() => setBulkEmailExportOpen(false)}
      />
    </div>
  );
}

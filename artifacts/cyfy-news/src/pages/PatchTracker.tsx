import { useState, useCallback, useEffect, useRef } from "react";
import { Wrench, ExternalLink, CheckCircle, AlertTriangle, Clock, ChevronDown } from "lucide-react";
import { SeverityBadge } from "@/components/Common/SeverityBadge";
import { Skeleton } from "@/components/ui/shared";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch as useWouterSearch } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

type PatchStatus = "all" | "available" | "applied" | "pending";
type ItemStatus = "new" | "under_review" | "patched" | "dismissed";

interface PatchAdvisory {
  id: number;
  title: string;
  cveId: string;
  vendor: string;
  severity: string;
  cvssScore: number;
  patchAvailable: boolean;
  patchUrl: string | null;
  status: string;
  publishedAt: string;
  source: string;
  summary: string | null;
}

interface PatchResponse {
  items: PatchAdvisory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function fetchPatches(params: {
  patchStatus: PatchStatus;
  vendor: string;
  severity: string;
  page: number;
}): Promise<PatchResponse> {
  const q = new URLSearchParams();
  if (params.patchStatus !== "all") q.set("patchStatus", params.patchStatus);
  if (params.vendor) q.set("vendor", params.vendor);
  if (params.severity) q.set("severity", params.severity);
  q.set("page", String(params.page));
  q.set("limit", "20");
  return fetch(`${apiBase}/advisories/patches?${q.toString()}`).then((r) => r.json());
}

function markPatched(id: number, status: string): Promise<void> {
  return fetch(`${apiBase}/advisories/${id}/patch-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then((r) => {
    if (!r.ok) throw new Error("Failed to update status");
  });
}

const STATUS_OPTIONS: Array<{ value: ItemStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "patched", label: "Applied" },
  { value: "dismissed", label: "Dismissed" },
];

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  new: { label: "New", icon: <Clock className="h-3.5 w-3.5" />, className: "text-muted-foreground" },
  under_review: { label: "Under Review", icon: <AlertTriangle className="h-3.5 w-3.5 text-warning" />, className: "text-warning" },
  patched: { label: "Applied", icon: <CheckCircle className="h-3.5 w-3.5 text-success" />, className: "text-success" },
  dismissed: { label: "Dismissed", icon: <Clock className="h-3.5 w-3.5" />, className: "text-muted-foreground" },
};

function StatusDropdown({
  status,
  disabled,
  onChange,
}: {
  status: string;
  disabled: boolean;
  onChange: (s: ItemStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.new;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded border border-transparent transition-colors",
          cfg.className,
          "hover:border-border/50 hover:bg-white/5 disabled:opacity-50"
        )}
      >
        {cfg.icon} {cfg.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-36 rounded-md border border-border bg-background shadow-lg py-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors",
                opt.value === status ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PatchTracker() {
  const searchString = useWouterSearch();
  const openId = new URLSearchParams(searchString).get("open");

  const [patchStatus, setPatchStatus] = useState<PatchStatus>("all");
  const [vendor, setVendor] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [highlightId, setHighlightId] = useState<number | null>(openId ? Number(openId) : null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["patches", patchStatus, vendor, severity, page],
    queryFn: () => fetchPatches({ patchStatus, vendor, severity, page }),
  });

  // Scroll to and highlight the deep-linked row
  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightId, data]);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => markPatched(id, status),
    onSuccess: () => {
      toast.success("Patch status updated");
      refetch();
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleStatusChange = useCallback(
    (id: number, status: string) => mutation.mutate({ id, status }),
    [mutation],
  );

  const handleBulkAction = useCallback(
    (status: ItemStatus) => {
      Promise.all([...selected].map((id) => markPatched(id, status)))
        .then(() => {
          toast.success(`${selected.size} items marked as ${STATUS_LABELS[status]?.label ?? status}`);
          setSelected(new Set());
          refetch();
        })
        .catch(() => toast.error("Some updates failed"));
    },
    [selected, refetch],
  );

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((i) => i.id)));
    }
  };

  const resetFilters = () => {
    setPatchStatus("all");
    setVendor("");
    setSeverity("");
    setPage(1);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight flex items-center gap-3 glow-text">
            <Wrench className="h-8 w-8 text-primary" /> Patch Tracker
          </h1>
          <p className="text-muted-foreground mt-2">
            Track available patches and remediation status for security advisories.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Patch status filter */}
          <div className="flex p-1 rounded-lg border border-border bg-secondary/50 gap-0.5">
            {(["all", "available", "applied", "pending"] as PatchStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setPatchStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  patchStatus === s ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "All" : s === "available" ? "Available" : s === "applied" ? "Applied" : "Pending"}
              </button>
            ))}
          </div>
          {/* Vendor filter */}
          <input
            type="text"
            value={vendor}
            onChange={(e) => { setVendor(e.target.value); setPage(1); }}
            placeholder="Vendor..."
            className="text-xs rounded-md border border-border bg-secondary px-2 py-2 text-foreground placeholder:text-muted-foreground w-28"
          />
          {/* Severity filter */}
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="text-xs rounded-md border border-border bg-secondary px-2 py-2 text-foreground"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {(patchStatus !== "all" || vendor || severity) && (
            <button type="button" onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleBulkAction(opt.value)}
                className="text-xs px-3 py-1.5 rounded border border-border/60 hover:border-primary/40 hover:text-primary transition-colors"
              >
                Mark {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Patches", value: data?.total ?? 0, className: "text-foreground" },
          { label: "Showing", value: data?.items.length ?? 0, className: "text-primary" },
          { label: "Page", value: data ? `${data.page} / ${data.totalPages}` : "—", className: "text-muted-foreground" },
        ].map(({ label, value, className }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-card/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold ${className}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isError ? (
        <div className="text-center py-20 text-destructive">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3" />
          <p>Failed to load patches. Please try again.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No patches found</p>
          <p className="text-sm">
            {patchStatus !== "all" || severity
              ? "Try clearing the filters."
              : "Patches will appear here once advisories with fixes are ingested."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-card/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={data !== undefined && selected.size === data.items.length && data.items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-border accent-primary"
                  />
                </th>
                <th className="text-left px-4 py-3">Advisory</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Vendor</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">CVSS</th>
                <th className="text-left px-4 py-3">Patch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Published</th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((item, idx) => {
                const isHighlighted = item.id === highlightId;
                const isSelected = selected.has(item.id);
                return (
                  <tr
                    key={item.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={cn(
                      "border-b border-white/5 transition-colors",
                      isHighlighted ? "bg-primary/10 border-l-2 border-l-primary" : idx % 2 === 0 ? "" : "bg-white/[0.02]",
                      isSelected ? "bg-primary/5" : "hover:bg-white/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(item.id)}
                        className="rounded border-border accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate text-sm" title={item.title}>{item.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.cveId}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{item.vendor}</td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono">
                      {item.cvssScore > 0 ? item.cvssScore.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.patchUrl ? (
                        <a
                          href={item.patchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View patch <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDropdown
                        status={item.status}
                        disabled={mutation.isPending}
                        onChange={(s) => handleStatusChange(item.id, s)}
                      />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {data?.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
            disabled={page === (data?.totalPages ?? 1)}
            className="px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

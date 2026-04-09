import { useState, useEffect } from "react";
import { X, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import { getEmailTemplates, exportEmailBatch } from "@/lib/exportApi";
import { toast } from "sonner";

interface TemplateListEntry {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
  description?: string;
}

interface BatchExportItem {
  id: number;
  certInId: string | null;
  title: string;
  subject: string;
  body: string;
}

interface BulkEmailExportModalProps {
  advisoryIds: number[];
  isCertIn?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function BulkEmailExportModal({
  advisoryIds,
  isCertIn = false,
  isOpen,
  onClose,
}: BulkEmailExportModalProps) {
  const [templates, setTemplates] = useState<TemplateListEntry[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [exports, setExports] = useState<BatchExportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      const type = isCertIn ? "cert-in" : "general";
      getEmailTemplates(type)
        .then((data) => {
          setTemplates(data as TemplateListEntry[]);
          const defaultT = data.find((t) => (t as TemplateListEntry).isDefault) ?? data[0];
          if (defaultT) setSelectedTemplateId(defaultT.id);
        })
        .catch(() => toast.error("Failed to load email templates"));
    }
  }, [isOpen, isCertIn]);

  const handleExport = async () => {
    if (!selectedTemplateId || advisoryIds.length === 0) return;
    setLoading(true);
    try {
      const data = await exportEmailBatch({
        advisoryIds,
        templateId: selectedTemplateId ?? undefined,
        format: "html",
      });
      setExports(data.exports ?? []);
    } catch {
      toast.error("Batch export failed");
    } finally {
      setLoading(false);
    }
  };

  const stripHtml = (html: string) =>
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* fall through */
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopy = async (item: BatchExportItem) => {
    const bodyText = item.body.includes("<") ? stripHtml(item.body) : item.body;
    const text = `Subject: ${item.subject}\n\n${bodyText}`;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (!isOpen) return null;

  const hasExports = exports.length > 0;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-4 md:inset-16 bg-card rounded-xl z-[61] flex flex-col overflow-hidden shadow-2xl border border-border">
        <div
          className={cn(
            "px-6 py-4 border-b border-border flex items-center justify-between",
            isCertIn
              ? "bg-gradient-to-r from-orange-500/20 to-transparent"
              : "bg-gradient-to-r from-primary/20 to-transparent"
          )}
        >
          <div className="flex items-center gap-3">
            <Mail
              className={cn(
                "w-6 h-6",
                isCertIn ? "text-orange-500" : "text-primary"
              )}
            />
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Bulk Export as Email
              </h2>
              <p className="text-sm text-muted-foreground">
                {advisoryIds.length} advisories selected
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {!hasExports ? (
            <>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Choose Template
                </h3>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                        selectedTemplateId === t.id
                          ? isCertIn
                            ? "border-orange-500 bg-orange-500/10 text-orange-400"
                            : "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:border-muted-foreground/30"
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleExport}
                  disabled={loading || !selectedTemplateId}
                  className={cn(
                    "gap-2",
                    isCertIn && "bg-orange-500 hover:bg-orange-600"
                  )}
                >
                  {loading ? (
                    "Exporting..."
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Export {advisoryIds.length} Advisories
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Export Results ({exports.length} advisories)
              </h3>
              {exports.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border border-border bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {item.subject}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(item)}
                      className="gap-2 shrink-0"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            {hasExports ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>
    </>
  );
}

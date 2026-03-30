import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import {
  X,
  Mail,
  Copy,
  Check,
  Eye,
  Edit3,
  Palette,
  RefreshCw,
  ExternalLink,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/shared";
import type { Advisory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { getEmailTemplates, previewEmail, exportEmail } from "@/lib/exportApi";

interface TemplateListEntry {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
  description?: string;
}

interface PreviewResult {
  subject: string;
  body: string;
  plainText: string;
}

interface EmailExportModalProps {
  advisory: Advisory | null;
  isOpen: boolean;
  onClose: () => void;
}

function TemplateSelector({
  templates,
  selectedId,
  onSelect,
  isCertIn,
}: {
  templates: TemplateListEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isCertIn: boolean;
}) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Choose Template
      </h3>
      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={cn(
              "w-full text-left p-4 rounded-lg border-2 transition-all",
              selectedId === template.id
                ? isCertIn
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-primary bg-primary/10"
                : "border-border bg-card hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-foreground">{template.name}</span>
              {template.isDefault && (
                <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {template.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomizationPanel({
  advisory,
  customizations,
  onChange,
}: {
  advisory: Advisory;
  customizations: Record<string, string>;
  onChange: (c: Record<string, string>) => void;
}) {
  const updateField = (field: string, value: string) => {
    onChange({ ...customizations, [field]: value });
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Customize Content
      </h3>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
          Business Impact (Optional)
        </label>
        <textarea
          value={customizations.businessImpact ?? ""}
          onChange={(e) => updateField("businessImpact", e.target.value)}
          placeholder="Describe the potential business impact..."
          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm resize-none h-24"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
          Additional Recommendations
        </label>
        <textarea
          value={customizations.additionalRecommendations ?? ""}
          onChange={(e) =>
            updateField("additionalRecommendations", e.target.value)
          }
          placeholder="Add custom recommendations..."
          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm resize-none h-24"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
          Internal Notes
        </label>
        <textarea
          value={customizations.internalNotes ?? ""}
          onChange={(e) => updateField("internalNotes", e.target.value)}
          placeholder="Notes for internal teams..."
          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm resize-none h-24"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
          Priority Override
        </label>
        <select
          value={customizations.priorityOverride ?? ""}
          onChange={(e) => updateField("priorityOverride", e.target.value)}
          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-sm"
        >
          <option value="">
            Use Default ({advisory.severity ?? "medium"})
          </option>
          <option value="critical">Critical - Immediate Action</option>
          <option value="high">High - Action Within 24 Hours</option>
          <option value="medium">Medium - Action This Week</option>
          <option value="low">Low - Informational</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
          Action Due Date
        </label>
        <input
          type="date"
          value={customizations.dueDate ?? ""}
          onChange={(e) => updateField("dueDate", e.target.value)}
          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-sm"
        />
      </div>
    </div>
  );
}

function QuickOptions({
  onCopySubject,
  onCopyBody,
  onCopyAll,
  onOpenMail,
  copied,
  disabled,
}: {
  onCopySubject: () => void;
  onCopyBody: () => void;
  onCopyAll: () => void;
  onOpenMail: () => void;
  copied: { subject: boolean; body: boolean };
  disabled?: boolean;
}) {
  return (
    <div className="flex-1 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Quick Actions
      </h3>
      <div className="space-y-2">
        <button
          onClick={onCopySubject}
          disabled={disabled}
          className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          {copied.subject ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Copy className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">
              Copy Subject Line
            </p>
            <p className="text-xs text-muted-foreground">For email subject</p>
          </div>
        </button>
        <button
          onClick={onCopyBody}
          className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors"
        >
          {copied.body ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">
              Copy Email Body
            </p>
            <p className="text-xs text-muted-foreground">
              Formatted HTML content
            </p>
          </div>
        </button>
        <button
          onClick={onCopyAll}
          disabled={disabled}
          className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          <Copy className="w-5 h-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">
              Copy All (Plain Text)
            </p>
            <p className="text-xs text-muted-foreground">
              Subject + body as text
            </p>
          </div>
        </button>
        <div className="border-t border-border my-4" />
        <button
          onClick={onOpenMail}
          className="w-full flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Mail className="w-5 h-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">
              Open in Mail App
            </p>
            <p className="text-xs text-muted-foreground">Compose new email</p>
          </div>
        </button>
      </div>
      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Tip
        </h4>
        <p className="text-xs text-muted-foreground">
          For best results, copy the email body and paste it directly into your
          email client. The formatting will be preserved in most email
          applications.
        </p>
      </div>
    </div>
  );
}

export function EmailExportModal({
  advisory,
  isOpen,
  onClose,
}: EmailExportModalProps) {
  const [templates, setTemplates] = useState<TemplateListEntry[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [customizations, setCustomizations] = useState<Record<string, string>>(
    {}
  );
  const [preview, setPreview] = useState<PreviewResult>({
    subject: "",
    body: "",
    plainText: "",
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState({ subject: false, body: false });
  const [activeTab, setActiveTab] = useState<"preview" | "customize" | "templates">("preview");

  const isCertIn = advisory?.isCertIn ?? advisory?.source === "CERT-In";

  const generatePreview = useCallback(async () => {
    if (!advisory) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const data = await previewEmail({
        advisoryId: advisory.id ?? advisory.certInId,
        templateId: selectedTemplateId ?? undefined,
        customizations: Object.keys(customizations).length
          ? customizations
          : undefined,
      });
      setPreview({
        subject: data.subject ?? "",
        body: data.body ?? "",
        plainText: data.plainText ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [advisory, selectedTemplateId, customizations]);

  useEffect(() => {
    if (isOpen && advisory) {
      const type = isCertIn ? "cert-in" : "general";
      getEmailTemplates(type)
        .then((data) => {
          setTemplates(data as TemplateListEntry[]);
          const defaultT = data.find((t) => (t as TemplateListEntry).isDefault) ?? data[0];
          if (defaultT) setSelectedTemplateId(defaultT.id);
        })
        .catch(console.error);
    }
  }, [isOpen, advisory, isCertIn]);

  useEffect(() => {
    if (isOpen && advisory && selectedTemplateId) {
      generatePreview();
    }
  }, [isOpen, advisory, selectedTemplateId, generatePreview]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* fall through to execCommand */
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopy = async (field: "subject" | "body") => {
    const text = field === "subject" ? preview.subject : preview.body;
    const textToCopy = field === "body" ? preview.plainText : text;
    try {
      if (field === "body" && navigator.clipboard?.write) {
        try {
          const htmlBlob = new Blob([preview.body], { type: "text/html" });
          const plainBlob = new Blob([preview.plainText], { type: "text/plain" });
          await navigator.clipboard.write([
            new ClipboardItem({ "text/html": htmlBlob, "text/plain": plainBlob }),
          ]);
          setCopied((prev) => ({ ...prev, [field]: true }));
          setTimeout(() => setCopied((prev) => ({ ...prev, [field]: false })), 2000);
          return;
        } catch {
          /* fall through to plain text */
        }
      }
      const ok = await copyToClipboard(textToCopy);
      if (ok) {
        setCopied((prev) => ({ ...prev, [field]: true }));
        setTimeout(() => setCopied((prev) => ({ ...prev, [field]: false })), 2000);
      }
    } catch {
      const ok = await copyToClipboard(textToCopy);
      if (ok) {
        setCopied((prev) => ({ ...prev, [field]: true }));
        setTimeout(() => setCopied((prev) => ({ ...prev, [field]: false })), 2000);
      }
    }
  };

  const handleCopyAll = async () => {
    const fullEmail = `Subject: ${preview.subject}\n\n${preview.plainText}`;
    const ok = await copyToClipboard(fullEmail);
    if (ok) {
      setCopied({ subject: true, body: true });
      setTimeout(() => setCopied({ subject: false, body: false }), 2000);
    }
  };

  const handleOpenInMail = async () => {
    try {
      const data = await exportEmail({
        advisoryId: advisory!.id ?? advisory!.certInId,
        templateId: selectedTemplateId ?? undefined,
        customizations: Object.keys(customizations).length
          ? customizations
          : undefined,
        format: "mailto",
      });
      if (data.mailtoLink) window.location.href = data.mailtoLink;
    } catch (e) {
      console.error("Failed to open mail client:", e);
    }
  };

  if (!isOpen || !advisory) return null;

  const tabs = [
    { id: "preview" as const, label: "Preview", icon: Eye },
    { id: "customize" as const, label: "Customize", icon: Edit3 },
    { id: "templates" as const, label: "Templates", icon: Palette },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
        <div className="bg-card rounded-xl flex flex-col overflow-hidden shadow-2xl border border-border w-full max-w-4xl max-h-[90vh]">
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
                Export as Email
              </h2>
              <p className="text-sm text-muted-foreground">
                {(advisory.certInId ?? advisory.title ?? "").toString().substring(0, 50)}...
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 py-2 border-b border-border flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className="w-80 border-r border-border flex flex-col">
            {activeTab === "templates" && (
              <TemplateSelector
                templates={templates}
                selectedId={selectedTemplateId}
                onSelect={setSelectedTemplateId}
                isCertIn={isCertIn}
              />
            )}
            {activeTab === "customize" && (
              <CustomizationPanel
                advisory={advisory}
                customizations={customizations}
                onChange={setCustomizations}
              />
            )}
            {activeTab === "preview" && (
              <QuickOptions
                onCopySubject={() => handleCopy("subject")}
                onCopyBody={() => handleCopy("body")}
                onCopyAll={handleCopyAll}
                onOpenMail={handleOpenInMail}
                copied={copied}
                disabled={!!error}
              />
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Subject
                  </label>
                  <p className="text-foreground font-medium mt-1">
                    {preview.subject || "Loading..."}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy("subject")}
                  title="Copy subject"
                >
                  {copied.subject ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    Generating preview...
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                  <Button onClick={generatePreview} variant="secondary">
                    Retry
                  </Button>
                </div>
              ) : (
                <div
                  className="email-preview p-5"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.body) }}
                />
              )}
            </div>

            <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Click &quot;Copy Body&quot; to copy the formatted email
              </span>
              <Button
                onClick={() => handleCopy("body")}
                disabled={!!error}
                className={cn(
                  "gap-2",
                  copied.body && "bg-green-600 hover:bg-green-600"
                )}
              >
                {copied.body ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Body
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Template:{" "}
            <span className="text-foreground font-medium">
              {templates.find((t) => t.id === selectedTemplateId)?.name ??
                "Default"}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleCopyAll} className="gap-2" disabled={!!error}>
              <Copy className="w-4 h-4" />
              Copy All
            </Button>
            <Button
              onClick={handleOpenInMail}
              disabled={!!error}
              className={cn(
                "gap-2",
                isCertIn
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : ""
              )}
            >
              <ExternalLink className="w-4 h-4" />
              Open in Mail App
            </Button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

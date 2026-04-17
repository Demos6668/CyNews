import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/shared";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmDialogProps {
  title: string;
  description: string;
  /** If provided, the user must type this string to confirm */
  confirmText?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  title,
  description,
  confirmText,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  isLoading,
}: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const confirmInputId = useId();

  const canConfirm = !confirmText || typed === confirmText;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-lg border border-red-500/30 bg-card p-6 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <p id={descriptionId} className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>

        {confirmText && (
          <div className="space-y-1">
            <label htmlFor={confirmInputId} className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{confirmText}</span> to confirm:
            </label>
            <input
              id={confirmInputId}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading || isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || loading || isLoading}
          >
            {loading || isLoading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
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

  const canConfirm = !confirmText || typed === confirmText;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>

        {confirmText && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{confirmText}</span> to confirm:
            </p>
            <input
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

import { useState } from "react";
import { Button } from "@/components/ui/shared";
import { Trash2, Undo2 } from "lucide-react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { toast } from "sonner";
import { useSessionContext } from "@/context/SessionContext";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function AccountDangerZone() {
  const { user } = useSessionContext();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<{
    requestId: string;
    purgeAfter: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function requestDeletion() {
    const res = await fetch(`${API_BASE}/api/account`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to schedule deletion");
      return;
    }
    const data = await res.json();
    setPendingDeletion({ requestId: data.requestId, purgeAfter: data.purgeAfter });
    setShowDeleteDialog(false);
    toast.success("Account deletion scheduled. You have 30 days to cancel.");
  }

  async function cancelDeletion() {
    if (!pendingDeletion) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/delete/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: pendingDeletion.requestId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to cancel deletion");
        return;
      }
      setPendingDeletion(null);
      toast.success("Account deletion cancelled.");
    } finally {
      setCancelling(false);
    }
  }

  const daysLeft = pendingDeletion
    ? Math.max(0, Math.ceil((new Date(pendingDeletion.purgeAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 space-y-4">
      <h3 className="text-base font-semibold text-red-400">Danger Zone</h3>

      {pendingDeletion ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Account deletion is pending. Your data will be permanently deleted in{" "}
            <span className="font-semibold text-red-400">{daysLeft} days</span>.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={cancelDeletion}
            disabled={cancelling}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            {cancelling ? "Cancelling..." : "Cancel deletion"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all your data after a 30-day grace period.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete account
          </Button>
        </div>
      )}

      {showDeleteDialog && (
        <DeleteConfirmDialog
          title="Delete your account"
          description="This will permanently delete your account after a 30-day grace period. All your data will be erased. This action cannot be undone."
          confirmText={user?.email ?? "my account"}
          confirmLabel="Schedule deletion"
          onConfirm={requestDeletion}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}

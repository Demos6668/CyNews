import { useEffect, useId } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutRow {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ["j", "↓"], description: "Move to next item" },
  { keys: ["k", "↑"], description: "Move to previous item" },
  { keys: ["o", "Enter"], description: "Open selected item" },
  { keys: ["b"], description: "Bookmark selected item" },
  { keys: ["/"], description: "Focus search bar" },
  { keys: ["?"], description: "Toggle this help panel" },
  { keys: ["Esc"], description: "Close detail / dismiss panel" },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const titleId = useId();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/40">
            {SHORTCUTS.map((row) => (
              <tr key={row.description} className="py-1">
                <td className="py-2 pr-4 w-32">
                  <span className="flex items-center gap-1 flex-wrap">
                    {row.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded border border-border bg-muted/40 text-[11px] font-mono font-medium text-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </td>
                <td className="py-2 text-muted-foreground">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] text-muted-foreground/60 text-center pt-1">
          Shortcuts are disabled while typing in any input field.
        </p>
      </div>
    </div>
  );
}

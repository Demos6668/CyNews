import { useEffect, useCallback, useRef } from "react";

interface UseKeyboardShortcutsOptions {
  onSearchFocus?: () => void;
  onItemDown?: () => void;
  onItemUp?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts for CYFY News Board:
 * - / : Focus search bar
 * - j : Navigate to next item (when applicable)
 * - k : Navigate to previous item (when applicable)
 */
export function useKeyboardShortcuts({
  onSearchFocus,
  onItemDown,
  onItemUp,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handlersRef = useRef({ onSearchFocus, onItemDown, onItemUp });
  handlersRef.current = { onSearchFocus, onItemDown, onItemUp };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore when typing in inputs/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        handlersRef.current.onSearchFocus?.();
        return;
      }

      if (e.key === "j" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handlersRef.current.onItemDown?.();
        return;
      }

      if (e.key === "k" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handlersRef.current.onItemUp?.();
        return;
      }
    },
    [enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

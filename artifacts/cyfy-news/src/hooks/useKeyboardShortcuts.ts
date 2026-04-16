import { useEffect, useCallback, useRef } from "react";

interface UseKeyboardShortcutsOptions {
  onSearchFocus?: () => void;
  onItemDown?: () => void;
  onItemUp?: () => void;
  onItemOpen?: () => void;
  onBookmark?: () => void;
  onHelpToggle?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts for CyNews list pages:
 *
 * j / ↓  — next item
 * k / ↑  — previous item
 * o / Enter — open selected item
 * b      — bookmark/unbookmark selected item
 * /      — focus search bar
 * ?      — toggle keyboard shortcut help
 */
export function useKeyboardShortcuts({
  onSearchFocus,
  onItemDown,
  onItemUp,
  onItemOpen,
  onBookmark,
  onHelpToggle,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handlersRef = useRef({
    onSearchFocus,
    onItemDown,
    onItemUp,
    onItemOpen,
    onBookmark,
    onHelpToggle,
  });
  handlersRef.current = {
    onSearchFocus,
    onItemDown,
    onItemUp,
    onItemOpen,
    onBookmark,
    onHelpToggle,
  };

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

      // Allow modifier keys to pass through
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          handlersRef.current.onSearchFocus?.();
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          handlersRef.current.onItemDown?.();
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          handlersRef.current.onItemUp?.();
          break;
        case "o":
        case "Enter":
          e.preventDefault();
          handlersRef.current.onItemOpen?.();
          break;
        case "b":
          e.preventDefault();
          handlersRef.current.onBookmark?.();
          break;
        case "?":
          e.preventDefault();
          handlersRef.current.onHelpToggle?.();
          break;
      }
    },
    [enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

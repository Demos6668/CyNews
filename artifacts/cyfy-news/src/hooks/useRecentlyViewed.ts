import { useState, useCallback, useEffect } from "react";
import {
  getRecentItems,
  addRecentItem,
  removeRecentItem,
  clearRecentItems,
  type RecentItem,
  type RecentItemType,
} from "@/lib/recentlyViewed";

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(() => getRecentItems());

  // Re-sync when another component (e.g. a detail modal) writes directly via addRecentItem()
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cyfy:recently-viewed") {
        setItems(getRecentItems());
      }
    };
    window.addEventListener("storage", onStorage);
    // Also listen to same-tab writes via a custom event
    const onSameTab = () => setItems(getRecentItems());
    window.addEventListener("cyfy:history-updated", onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cyfy:history-updated", onSameTab);
    };
  }, []);

  const add = useCallback(
    (item: { id: number; type: RecentItemType; title: string; severity?: string }) => {
      const updated = addRecentItem(item);
      setItems(updated);
      window.dispatchEvent(new Event("cyfy:history-updated"));
    },
    []
  );

  const remove = useCallback((id: number, type: RecentItemType) => {
    const updated = removeRecentItem(id, type);
    setItems(updated);
    window.dispatchEvent(new Event("cyfy:history-updated"));
  }, []);

  const clear = useCallback(() => {
    clearRecentItems();
    setItems([]);
    window.dispatchEvent(new Event("cyfy:history-updated"));
  }, []);

  return { items, add, remove, clear };
}

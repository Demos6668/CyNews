const STORAGE_KEY = "cyfy:recently-viewed";
const MAX_ITEMS = 20;

export type RecentItemType = "advisory" | "threat" | "news";

export interface RecentItem {
  id: number;
  type: RecentItemType;
  title: string;
  severity?: string;
  visitedAt: string; // ISO string
}

export function getRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

export function addRecentItem(item: Omit<RecentItem, "visitedAt">): RecentItem[] {
  const existing = getRecentItems();
  // Remove duplicate by id+type, then prepend, then cap
  const deduped = existing.filter((r) => !(r.id === item.id && r.type === item.type));
  const updated: RecentItem[] = [
    { ...item, visitedAt: new Date().toISOString() },
    ...deduped,
  ].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // quota exceeded — silently skip
  }
  return updated;
}

export function removeRecentItem(id: number, type: RecentItemType): RecentItem[] {
  const updated = getRecentItems().filter((r) => !(r.id === id && r.type === type));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // quota exceeded — silently skip
  }
  return updated;
}

export function clearRecentItems(): void {
  localStorage.removeItem(STORAGE_KEY);
}

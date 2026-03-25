import { create } from "zustand";

/**
 * Client-side cache of bookmarked item IDs for quick UI feedback.
 * Server remains source of truth - this is optional for optimistic updates.
 */
interface BookmarksState {
  bookmarkedIds: Set<number>;
  addBookmark: (id: number) => void;
  removeBookmark: (id: number) => void;
  toggleBookmark: (id: number) => void;
  setBookmarks: (ids: number[]) => void;
  isBookmarked: (id: number) => boolean;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  bookmarkedIds: new Set<number>(),
  addBookmark: (id) =>
    set((s) => ({
      bookmarkedIds: new Set([...s.bookmarkedIds, id]),
    })),
  removeBookmark: (id) =>
    set((s) => {
      const next = new Set(s.bookmarkedIds);
      next.delete(id);
      return { bookmarkedIds: next };
    }),
  toggleBookmark: (id) =>
    set((s) => {
      const next = new Set(s.bookmarkedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { bookmarkedIds: next };
    }),
  setBookmarks: (ids) =>
    set({ bookmarkedIds: new Set(ids) }),
  isBookmarked: (id) => get().bookmarkedIds.has(id),
}));

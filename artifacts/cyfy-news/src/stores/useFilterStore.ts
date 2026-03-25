import { create } from "zustand";

export type NewsScope = "local" | "global";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

interface FilterState {
  scope: NewsScope;
  severity: Severity | undefined;
  category: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  setScope: (scope: NewsScope) => void;
  setSeverity: (severity: Severity | undefined) => void;
  setCategory: (category: string | undefined) => void;
  setDateRange: (from: string | undefined, to: string | undefined) => void;
  clearFilters: () => void;
}

const initialState = {
  scope: "local" as NewsScope,
  severity: undefined as Severity | undefined,
  category: undefined as string | undefined,
  dateFrom: undefined as string | undefined,
  dateTo: undefined as string | undefined,
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,
  setScope: (scope) => set({ scope }),
  setSeverity: (severity) => set({ severity }),
  setCategory: (category) => set({ category }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  clearFilters: () => set(initialState),
}));

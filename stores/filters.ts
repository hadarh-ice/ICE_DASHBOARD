import { create } from 'zustand';
import { DateRange } from 'react-day-picker';

interface FilterState {
  dateRange: DateRange | undefined;
  selectedEmployees: string[];
  setDateRange: (range: DateRange | undefined) => void;
  setSelectedEmployees: (employees: string[]) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  dateRange: undefined,
  selectedEmployees: [],
  setDateRange: (range) => set({ dateRange: range }),
  setSelectedEmployees: (employees) => set({ selectedEmployees: employees }),
  clearFilters: () => set({ dateRange: undefined, selectedEmployees: [] }),
}));

// ──────────────────────────────────────────────────────────────
// Prompt History Store
// ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { Prompt, PromptHistoryFilters, PromptVersion } from '@/types/prompt';

interface HistoryState {
  // History list
  prompts: Prompt[];
  setPrompts: (prompts: Prompt[]) => void;
  addPrompt: (prompt: Prompt) => void;

  // Pagination
  total: number;
  page: number;
  hasMore: boolean;
  setPage: (page: number) => void;

  // Filters
  filters: PromptHistoryFilters;
  setFilters: (filters: PromptHistoryFilters) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Selected prompt
  selectedPromptId: string | null;
  setSelectedPromptId: (id: string | null) => void;

  // Versions for selected prompt
  versions: PromptVersion[];
  setVersions: (versions: PromptVersion[]) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Reset
  reset: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  prompts: [],
  setPrompts: (prompts) => set({ prompts }),
  addPrompt: (prompt) => set({ prompts: [prompt, ...get().prompts] }),

  total: 0,
  page: 1,
  hasMore: false,
  setPage: (page) => set({ page }),

  filters: { timeRange: 'all', limit: 20 },
  setFilters: (filters) => set({ filters, page: 1 }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  selectedPromptId: null,
  setSelectedPromptId: (selectedPromptId) => set({ selectedPromptId }),

  versions: [],
  setVersions: (versions) => set({ versions }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      prompts: [],
      total: 0,
      page: 1,
      hasMore: false,
      filters: { timeRange: 'all', limit: 20 },
      searchQuery: '',
      selectedPromptId: null,
      versions: [],
      isLoading: false,
    }),
}));

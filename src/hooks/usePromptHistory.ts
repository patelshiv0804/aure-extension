// ──────────────────────────────────────────────────────────────
// usePromptHistory — Hook for prompt history
// ──────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import { sendMessage } from '@/lib/messaging';
import type { Prompt, PromptHistoryFilters, PromptHistoryResult } from '@/types/prompt';

export function usePromptHistory(initialFilters?: PromptHistoryFilters) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<PromptHistoryFilters>(
    initialFilters ?? { timeRange: 'all', limit: 20, page: 1 }
  );

  const fetchHistory = useCallback(async (overrideFilters?: PromptHistoryFilters) => {
    const activeFilters = overrideFilters ?? filters;
    setIsLoading(true);
    try {
      const result: PromptHistoryResult = await sendMessage('GET_HISTORY', activeFilters);
      if ((activeFilters.page ?? 1) > 1) {
        setPrompts((prev) => [...prev, ...result.prompts]);
      } else {
        setPrompts(result.prompts);
      }
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    const nextPage = (filters.page ?? 1) + 1;
    const newFilters = { ...filters, page: nextPage };
    setFilters(newFilters);
    fetchHistory(newFilters);
  }, [hasMore, isLoading, filters, fetchHistory]);

  const updateFilters = useCallback((newFilters: Partial<PromptHistoryFilters>) => {
    const merged = { ...filters, ...newFilters, page: 1 };
    setFilters(merged);
    fetchHistory(merged);
  }, [filters, fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    prompts,
    total,
    hasMore,
    isLoading,
    filters,
    fetchHistory,
    loadMore,
    updateFilters,
  };
}

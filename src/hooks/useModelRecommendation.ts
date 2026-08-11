// ──────────────────────────────────────────────────────────────
// useModelRecommendation — Hook for AI model recommendations
// ──────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { sendMessage } from '@/lib/messaging';
import type { ModelRecommendation } from '@/types/messages';

export function useModelRecommendation() {
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getRecommendation = useCallback(
    async (prompt: string, category: string, currentModel: string) => {
      setIsLoading(true);
      try {
        const result = await sendMessage('RECOMMEND_MODEL', {
          prompt,
          category,
          currentModel,
        });
        setRecommendation(result);
        return result;
      } catch (error) {
        console.error('Failed to get recommendation:', error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const dismiss = useCallback(() => {
    setRecommendation(null);
  }, []);

  return { recommendation, isLoading, getRecommendation, dismiss };
}

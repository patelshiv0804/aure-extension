// ──────────────────────────────────────────────────────────────
// useEnhance — Hook for the enhancement flow
// ──────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { sendMessage } from '@/lib/messaging';
import { useEnhanceStore } from '@/stores/enhance.store';
import type { EnhancementMode } from '@/types/enhancement';

export function useEnhance() {
  const {
    flowState,
    currentPrompt,
    selectedMode,
    enhanceResult,
    recommendation,
    error,
    setFlowState,
    setCurrentPrompt,
    setSelectedMode,
    setEnhanceResult,
    setRecommendation,
    setError,
    reset,
  } = useEnhanceStore();

  const enhance = useCallback(
    async (prompt: string, mode: EnhancementMode, platform: string) => {
      if (useEnhanceStore.getState().flowState === 'enhancing') return;
      setCurrentPrompt(prompt);
      setSelectedMode(mode);
      setFlowState('enhancing');
      setError(null);

      try {
        const result = await sendMessage('ENHANCE_PROMPT', { prompt, mode, platform });
        setEnhanceResult(result);
        setFlowState('comparing');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Enhancement failed';
        setError(message);
        setFlowState('error');
        throw err;
      }
    },
    [setCurrentPrompt, setSelectedMode, setFlowState, setError, setEnhanceResult]
  );

  const getRecommendation = useCallback(
    async (prompt: string, category: string, currentModel: string) => {
      try {
        const rec = await sendMessage('RECOMMEND_MODEL', { prompt, category, currentModel });
        setRecommendation(rec);
        return rec;
      } catch {
        // Non-critical — don't fail the flow
        return null;
      }
    },
    [setRecommendation]
  );

  return {
    flowState,
    currentPrompt,
    selectedMode,
    enhanceResult,
    recommendation,
    error,
    enhance,
    getRecommendation,
    reset,
  };
}

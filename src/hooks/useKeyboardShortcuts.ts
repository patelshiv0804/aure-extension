// ──────────────────────────────────────────────────────────────
// useKeyboardShortcuts — Content script keyboard shortcuts
// ──────────────────────────────────────────────────────────────

import { useEffect, useCallback } from 'react';
import { useEnhanceStore } from '@/stores/enhance.store';

interface ShortcutHandlers {
  onEnhance?: () => void;
  onChangeMode?: () => void;
  onRecommendation?: () => void;
  onVersions?: () => void;
  onCompare?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const { flowState, reset } = useEnhanceStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in input fields (except our own)
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isOurUI = target.closest?.('#pe-app');

      // Escape always works
      if (e.key === 'Escape') {
        if (flowState !== 'idle') {
          e.preventDefault();
          reset();
        }
        return;
      }

      // Other shortcuts only work when NOT typing in a foreign input
      if (isInInput && !isOurUI) return;
      if (!e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'e':
          e.preventDefault();
          handlers.onEnhance?.();
          break;
        case 'm':
          e.preventDefault();
          handlers.onChangeMode?.();
          break;
        case 'r':
          e.preventDefault();
          handlers.onRecommendation?.();
          break;
        case 'v':
          e.preventDefault();
          handlers.onVersions?.();
          break;
        case 'c':
          e.preventDefault();
          handlers.onCompare?.();
          break;
      }
    },
    [flowState, reset, handlers]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

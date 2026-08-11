// ──────────────────────────────────────────────────────────────
// ContentRoot — Root component for content script UI
// Manages the enhancement flow state machine
// ──────────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useRef } from 'react';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { useSettingsStore } from '@/stores/settings.store';
import { classifyPrompt, getPromptSuggestions } from '@/lib/classifier';
import { debounce } from '@/lib/debounce';
import { sendMessage } from '@/lib/messaging';
import type { EnhancementMode } from '@/types/enhancement';
import { FloatingEnhanceButton } from './FloatingEnhanceButton';
import { EnhancementModePanel } from './EnhancementModePanel';
import { ComparisonPanel } from './ComparisonPanel';
import { InlineSuggestions } from './InlineSuggestions';
import { ModelRecommendation } from './ModelRecommendation';
import { EnhancedBadge } from './EnhancedBadge';

interface ContentRootProps {
  adapter: SiteAdapter;
}

export const ContentRoot: React.FC<ContentRootProps> = ({ adapter }) => {
  const adapterRef = useRef(adapter);
  const {
    flowState,
    setFlowState,
    showButton,
    setShowButton,
    setCurrentPrompt,
    setActiveInput,
    setSuggestions,
    setEnhanceResult,
    setRecommendation,
    activeInput,
    enhanceResult,
    reset,
  } = useEnhanceStore();

  const { loadSettings } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Track prompt changes for inline suggestions
  const handlePromptChange = useCallback(
    debounce(() => {
      const text = adapterRef.current.extractPrompt();
      if (text.length > 5) {
        setCurrentPrompt(text);
        const suggestions = getPromptSuggestions(text);
        setSuggestions(suggestions);
      } else {
        setSuggestions([]);
      }
    }, 300),
    []
  );

  // Set up adapter observation
  useEffect(() => {
    const currentAdapter = adapterRef.current;

    currentAdapter.observeChanges((input: HTMLElement) => {
      setActiveInput(input);

      // Show button on input focus
      const handleFocus = () => {
        setShowButton(true);
        handlePromptChange();
      };

      const handleBlur = () => {
        // Delay hide to allow clicking the enhance button
        setTimeout(() => {
          if (!document.activeElement?.closest?.('#pe-app')) {
            setShowButton(false);
          }
        }, 200);
      };

      const handleInput = () => {
        handlePromptChange();
      };

      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
      input.addEventListener('input', handleInput);

      // Auto-show if already focused
      if (document.activeElement === input) {
        handleFocus();
      }

      return () => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('input', handleInput);
      };
    });

    return () => {
      currentAdapter.disconnect();
    };
  }, [setActiveInput, setShowButton, handlePromptChange]);

  // Listen for keyboard shortcuts from background
  useEffect(() => {
    const handler = (message: { type: string }) => {
      switch (message.type) {
        case 'SHORTCUT_ENHANCE':
          if (activeInput) {
            setCurrentPrompt(adapterRef.current.extractPrompt());
            setFlowState('selecting');
          }
          break;
        case 'SHORTCUT_MODE':
          setFlowState('selecting');
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [activeInput, setCurrentPrompt, setFlowState]);

  // Global keyboard shortcuts within content script
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close any panel
      if (e.key === 'Escape' && flowState !== 'idle') {
        e.preventDefault();
        reset();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [flowState, reset]);

  const triggerEnhance = useCallback(
    async (mode: EnhancementMode, role?: string, roleMode?: string) => {
      const prompt = adapterRef.current.extractPrompt();
      if (!prompt.trim()) return;

      setCurrentPrompt(prompt);
      useEnhanceStore.getState().setSelectedMode(mode);
      if (role) useEnhanceStore.getState().setSelectedRole(role);
      if (roleMode) useEnhanceStore.getState().setSelectedRoleMode(roleMode);
      setFlowState('enhancing');

      try {
        // Parallel: enhance + recommend
        const [result, recommendation] = await Promise.allSettled([
          sendMessage('ENHANCE_PROMPT', {
            prompt,
            mode,
            role: role ?? mode,
            platform: adapter.getPlatformName(),
          }),
          sendMessage('RECOMMEND_MODEL', {
            prompt,
            category: mode,
            currentModel: adapter.getPlatformName().toLowerCase(),
          }),
        ]);

        if (result.status === 'fulfilled') {
          setEnhanceResult(result.value);
          // Directly replace text inside input box
          await adapterRef.current.injectPrompt(result.value.enhancedPrompt);
          setFlowState('injected');
          useEnhanceStore.getState().setShowRecommendation(true);
        } else {
          throw new Error(result.reason?.message ?? 'Enhancement failed');
        }

        if (recommendation.status === 'fulfilled') {
          setRecommendation(recommendation.value);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Enhancement failed';
        useEnhanceStore.getState().setError(message);
        setFlowState('error');
      }
    },
    [setCurrentPrompt, setFlowState, setEnhanceResult, setRecommendation, adapter]
  );

  const handleEnhanceClick = useCallback(() => {
    const prompt = adapterRef.current.extractPrompt();
    if (!prompt.trim()) return;

    const classification = classifyPrompt(prompt);
    triggerEnhance(classification.enhancementMode);
  }, [triggerEnhance]);

  const handleOpenHistory = useCallback(() => {
    sendMessage('OPEN_SIDE_PANEL', undefined).catch((err) => {
      console.error('[AURE] Failed to open side panel:', err);
    });
  }, []);

  const handleUndo = useCallback(async () => {
    if (flowState === 'injected' && enhanceResult?.originalPrompt) {
      try {
        await adapterRef.current.injectPrompt(enhanceResult.originalPrompt);
      } catch (err) {
        console.error('[AURE] Failed to undo prompt:', err);
      }
    }
    reset();
  }, [flowState, enhanceResult, reset]);

  const handleInjectPrompt = useCallback(
    async (text: string) => {
      try {
        await adapterRef.current.injectPrompt(text);
        setFlowState('injected');
      } catch (error) {
        console.error('[AURE] Injection failed:', error);
        useEnhanceStore.getState().setError('Failed to inject prompt');
        setFlowState('error');
      }
    },
    [setFlowState]
  );

  return (
    <>
      {/* Floating Enhance Button */}
      {showButton && (
        <FloatingEnhanceButton
          adapter={adapter}
          onEnhance={handleEnhanceClick}
          onOpenHistory={handleOpenHistory}
        />
      )}

      {/* Enhancement Mode Selection Panel */}
      {flowState === 'selecting' && (
        <EnhancementModePanel adapter={adapter} onSelectMode={triggerEnhance} />
      )}

      {/* In-Place Enhanced Badge (Undo / Compare) */}
      {flowState === 'injected' && (
        <EnhancedBadge
          adapter={adapter}
          onUndo={handleUndo}
          onCompare={() => setFlowState('comparing')}
          onDismiss={() => reset()}
        />
      )}

      {/* Comparison Panel (Optional side-by-side modal) */}
      {flowState === 'comparing' && (
        <ComparisonPanel
          adapter={adapter}
          onAccept={handleInjectPrompt}
          onReject={handleUndo}
        />
      )}

      {/* Inline Suggestions */}
      {showButton && flowState === 'idle' && (
        <InlineSuggestions adapter={adapter} />
      )}

      {/* Model Recommendation & Top-Right Score Card */}
      <ModelRecommendation adapter={adapter} />
    </>
  );
};

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
import { useAuthStore } from '@/stores/auth.store';
import { getStorage } from '@/lib/storage';
import { formatPromptText } from '@/lib/formatter';
import { FloatingEnhanceButton } from './FloatingEnhanceButton';
import { EnhancementModePanel } from './EnhancementModePanel';
import { ComparisonPanel } from './ComparisonPanel';
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
    isUndone,
    setIsUndone,
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

    // Keep track of cleanup functions for event listeners per input
    let cleanupListeners: (() => void) | null = null;

    const attachToInput = (input: HTMLElement) => {
      // Remove listeners from previous input before attaching to new one
      if (cleanupListeners) {
        cleanupListeners();
        cleanupListeners = null;
      }

      setActiveInput(input);

      // ── Show button IMMEDIATELY when input is detected ────────────────────
      // This is the key fix: do NOT wait for focus. Show as soon as we know
      // the textarea exists on the page, exactly like Promptive Sentry does.
      setShowButton(true);
      handlePromptChange();

      // ── IntersectionObserver: hide/show as input enters/leaves viewport ──
      let intersectionObserver: IntersectionObserver | null = null;
      if (typeof IntersectionObserver !== 'undefined') {
        intersectionObserver = new IntersectionObserver(
          ([entry]) => {
            // Show when textarea is in view, hide when scrolled out
            setShowButton(entry.isIntersecting);
          },
          { threshold: 0.1 }
        );
        intersectionObserver.observe(input);
      }

      const handleInput = () => {
        handlePromptChange();
      };

      input.addEventListener('input', handleInput);

      cleanupListeners = () => {
        input.removeEventListener('input', handleInput);
        intersectionObserver?.disconnect();
      };
    };

    currentAdapter.observeChanges(attachToInput);

    return () => {
      currentAdapter.disconnect();
      if (cleanupListeners) {
        cleanupListeners();
      }
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

  const isEnhancingRef = useRef(false);

  const triggerEnhance = useCallback(
    async (mode: EnhancementMode, role?: string, roleMode?: string) => {
      // 1. Synchronously prevent concurrent enhancement requests
      if (isEnhancingRef.current || useEnhanceStore.getState().flowState === 'enhancing') {
        console.warn('[AURE] Enhance already in progress, ignoring duplicate call');
        return;
      }

      const prompt = adapterRef.current.extractPrompt();
      if (!prompt.trim()) {
        useEnhanceStore.getState().setError('Please enter a prompt first.');
        setFlowState('error');
        setTimeout(() => {
          if (useEnhanceStore.getState().flowState === 'error') {
            useEnhanceStore.getState().reset();
          }
        }, 3000);
        return;
      }

      // Mark as enhancing immediately (synchronous lock before any await)
      isEnhancingRef.current = true;
      setFlowState('enhancing');
      useEnhanceStore.getState().setError(null);
      setCurrentPrompt(prompt);
      useEnhanceStore.getState().setSelectedMode(mode);
      if (role) useEnhanceStore.getState().setSelectedRole(role);
      if (roleMode) useEnhanceStore.getState().setSelectedRoleMode(roleMode);

      try {
        // Check login status before calling backend API
        await useAuthStore.getState().loadAuth();
        const { isAuthenticated, user } = useAuthStore.getState();
        const cachedProfile = await getStorage('userProfile');

        if (!isAuthenticated && !user && !cachedProfile) {
          useEnhanceStore.getState().setError('You are not logged in. Please sign in to enhance prompts.');
          setFlowState('error');
          // Open workspace sidepanel automatically for quick login
          sendMessage('OPEN_SIDE_PANEL', undefined).catch(() => {});
          return;
        }

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
          // Directly replace text inside input box with formatted clean prompt
          const cleanText = formatPromptText(result.value.enhancedPrompt);
          await adapterRef.current.injectPrompt(cleanText);
          setIsUndone(false);
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
      } finally {
        isEnhancingRef.current = false;
      }
    },
    [setCurrentPrompt, setFlowState, setEnhanceResult, setRecommendation, adapter, setIsUndone]
  );

  const handleEnhanceClick = useCallback(() => {
    if (isEnhancingRef.current || useEnhanceStore.getState().flowState === 'enhancing') {
      return;
    }
    const prompt = adapterRef.current.extractPrompt();
    if (!prompt.trim()) {
      useEnhanceStore.getState().setError('Please enter a prompt first.');
      setFlowState('error');
      setTimeout(() => {
        if (useEnhanceStore.getState().flowState === 'error') {
          useEnhanceStore.getState().reset();
        }
      }, 3000);
      return;
    }

    const classification = classifyPrompt(prompt);
    triggerEnhance(classification.enhancementMode);
  }, [triggerEnhance, setFlowState]);

  const handleOpenHistory = useCallback(() => {
    sendMessage('OPEN_SIDE_PANEL', undefined).catch((err) => {
      console.error('[AURE] Failed to open side panel:', err);
    });
  }, []);

  const handleUndo = useCallback(async () => {
    if (enhanceResult?.originalPrompt) {
      try {
        await adapterRef.current.injectPrompt(enhanceResult.originalPrompt);
        setIsUndone(true);
      } catch (err) {
        console.error('[AURE] Failed to undo prompt:', err);
      }
    }
  }, [enhanceResult, setIsUndone]);

  const handleReapply = useCallback(async () => {
    if (enhanceResult?.enhancedPrompt) {
      try {
        await adapterRef.current.injectPrompt(enhanceResult.enhancedPrompt);
        setIsUndone(false);
      } catch (err) {
        console.error('[AURE] Failed to reapply enhanced prompt:', err);
      }
    }
  }, [enhanceResult, setIsUndone]);

  const handleInjectPrompt = useCallback(
    async (text: string) => {
      try {
        await adapterRef.current.injectPrompt(formatPromptText(text));
        setIsUndone(false);
        setFlowState('injected');
      } catch (error) {
        console.error('[AURE] Injection failed:', error);
        useEnhanceStore.getState().setError('Failed to inject prompt');
        setFlowState('error');
      }
    },
    [setFlowState, setIsUndone]
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

      {/* In-Place Enhanced Badge (Undo / Retain Enhanced Prompt / Compare) */}
      {(flowState === 'injected' || flowState === 'comparing') && enhanceResult && (
        <EnhancedBadge
          adapter={adapter}
          isUndone={isUndone}
          onUndo={handleUndo}
          onReapply={handleReapply}
          onCompare={() => setFlowState('comparing')}
          onDismiss={() => reset()}
        />
      )}

      {/* Comparison Panel (Optional side-by-side modal) */}
      {flowState === 'comparing' && (
        <ComparisonPanel
          adapter={adapter}
          onAccept={handleInjectPrompt}
          onReject={() => setFlowState('injected')}
        />
      )}

      {/* Model Recommendation & Top-Right Score Card */}
      <ModelRecommendation adapter={adapter} />
    </>
  );
};

// ──────────────────────────────────────────────────────────────
// ContentRoot — Root component for content script UI
// Manages the enhancement flow state machine
// ──────────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useRef, useState } from 'react';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { useSettingsStore } from '@/stores/settings.store';
import { classifyPrompt, getPromptSuggestions } from '@/lib/classifier';
import { debounce } from '@/lib/debounce';
import { sendMessage } from '@/lib/messaging';
import type { EnhancementMode, EnhanceResult } from '@/types/enhancement';
import { useAuthStore } from '@/stores/auth.store';
import { getStorage } from '@/lib/storage';
import { formatPromptText } from '@/lib/formatter';
import { FloatingEnhanceButton } from './FloatingEnhanceButton';
import { EnhancementModePanel } from './EnhancementModePanel';
import { ComparisonPanel } from './ComparisonPanel';
import { ModelRecommendation } from './ModelRecommendation';
import { EnhancedBadge, type PromptVersionItem } from './EnhancedBadge';

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
    currentPrompt,
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
  const isCancelledRef = useRef(false);

  const handleCancelEnhance = useCallback(() => {
    isCancelledRef.current = true;
    isEnhancingRef.current = false;
    setFlowState('idle');
    useEnhanceStore.getState().setError(null);
    sendMessage('CANCEL_ENHANCE', { promptId: enhanceResult?.promptId }).catch(() => {});
    console.log('[AURE] Prompt enhancement cancelled by user — aborted backend API');
  }, [setFlowState, enhanceResult]);

  const triggerEnhance = useCallback(
    async (mode: EnhancementMode, role?: string, roleMode?: string) => {
      // 1. Synchronously prevent concurrent enhancement requests
      if (isEnhancingRef.current || useEnhanceStore.getState().flowState === 'enhancing') {
        console.warn('[AURE] Enhance already in progress, ignoring duplicate call');
        return;
      }

      // Priority 1: Check login status before validating prompt or calling backend
      await useAuthStore.getState().loadAuth();
      if (isCancelledRef.current) return;

      const { isAuthenticated, user } = useAuthStore.getState();
      const cachedProfile = await getStorage('userProfile');

      if (!isAuthenticated && !user && !cachedProfile) {
        if (isCancelledRef.current) return;
        useEnhanceStore.getState().setError('You are not logged in. Please sign in to enhance prompts.');
        setFlowState('error');
        // Open workspace sidepanel automatically for quick login
        sendMessage('OPEN_SIDE_PANEL', undefined).catch(() => {});
        setTimeout(() => {
          if (useEnhanceStore.getState().flowState === 'error') {
            useEnhanceStore.getState().reset();
          }
        }, 4000);
        return;
      }

      // Priority 2: Check prompt presence
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
      isCancelledRef.current = false;
      setFlowState('enhancing');
      useEnhanceStore.getState().setError(null);
      setCurrentPrompt(prompt);
      useEnhanceStore.getState().setSelectedMode(mode);
      if (role) useEnhanceStore.getState().setSelectedRole(role);
      if (roleMode) useEnhanceStore.getState().setSelectedRoleMode(roleMode);

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

        // If user pressed Cancel while waiting for network, discard results completely
        if (isCancelledRef.current) {
          console.log('[AURE] Enhancement completed after user cancelled. Discarding output.');
          return;
        }

        if (result.status === 'fulfilled') {
          setEnhanceResult(result.value);
          // Directly replace text inside input box with formatted clean prompt
          const orig = result.value.originalPrompt || prompt;
          const cleanText = formatPromptText(result.value.enhancedPrompt);
          await adapterRef.current.injectPrompt(cleanText);
          setIsUndone(false);
          setFlowState('injected');
          useEnhanceStore.getState().setShowRecommendation(true);

          // Initialize version history: 0 = Original, 1 = v1-enhanced
          setVersionHistory([
            { versionNumber: 0, text: orig, label: 'Original' },
            { versionNumber: 1, text: result.value.enhancedPrompt, label: 'v1-enhanced' },
          ]);
          setActiveVersionNumber(1);
          setIsPromptSaved(false);
        } else {
          throw new Error(result.reason?.message ?? 'Enhancement failed');
        }

        if (recommendation.status === 'fulfilled') {
          setRecommendation(recommendation.value);
        }
      } catch (error) {
        if (isCancelledRef.current) return;
        const message = error instanceof Error ? error.message : 'Enhancement failed';
        useEnhanceStore.getState().setError(message);
        setFlowState('error');
      } finally {
        isEnhancingRef.current = false;
      }
    },
    [setCurrentPrompt, setFlowState, setEnhanceResult, setRecommendation, adapter, setIsUndone]
  );

  const handleEnhanceClick = useCallback(async () => {
    if (isEnhancingRef.current || useEnhanceStore.getState().flowState === 'enhancing') {
      return;
    }

    // Priority 1: Check login status
    await useAuthStore.getState().loadAuth();
    const { isAuthenticated, user } = useAuthStore.getState();
    const cachedProfile = await getStorage('userProfile');

    if (!isAuthenticated && !user && !cachedProfile) {
      useEnhanceStore.getState().setError('You are not logged in. Please sign in to enhance prompts.');
      setFlowState('error');
      sendMessage('OPEN_SIDE_PANEL', undefined).catch(() => {});
      setTimeout(() => {
        if (useEnhanceStore.getState().flowState === 'error') {
          useEnhanceStore.getState().reset();
        }
      }, 4000);
      return;
    }

    // Priority 2: Check prompt
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

  const [versionHistory, setVersionHistory] = useState<PromptVersionItem[]>([]);
  const [activeVersionNumber, setActiveVersionNumber] = useState<number>(1);
  const [isPromptSaved, setIsPromptSaved] = useState<boolean>(false);
  const [isReenhancing, setIsReenhancing] = useState(false);
  const isReenhancingRef = useRef(false);
  const isReenhanceCancelledRef = useRef(false);

  const handleSavePrompt = useCallback(async () => {
    if (!enhanceResult || isPromptSaved) return;
    try {
      const activeText = adapterRef.current.extractPrompt() || enhanceResult.enhancedPrompt;
      const res = await sendMessage('SAVE_ENHANCED_PROMPT', {
        original_prompt: enhanceResult.originalPrompt || currentPrompt,
        enhanced_prompt: activeText,
        old_analysis: enhanceResult.originalAnalysis,
        new_analysis: enhanceResult.enhancedAnalysis,
        tool_recommendations: { tools: enhanceResult.toolRecommendations },
        role: useEnhanceStore.getState().selectedRole || 'General',
        mode: useEnhanceStore.getState().selectedMode || enhanceResult.mode || 'general',
      });
      if (res.success) {
        setIsPromptSaved(true);
      }
    } catch (err) {
      console.error('[AURE] Failed to save prompt to vault:', err);
    }
  }, [enhanceResult, isPromptSaved, currentPrompt]);

  const handleCancelReenhance = useCallback(() => {
    isReenhanceCancelledRef.current = true;
    isReenhancingRef.current = false;
    setIsReenhancing(false);
    sendMessage('CANCEL_ENHANCE', { promptId: enhanceResult?.promptId }).catch(() => {});
    console.log('[AURE] Re-enhancement cancelled by user — aborted backend API');
  }, [enhanceResult]);

  const handleSelectVersion = useCallback(
    async (verNum: number) => {
      const targetVer = versionHistory.find((v) => v.versionNumber === verNum);
      if (targetVer) {
        setActiveVersionNumber(verNum);
        const formatted = formatPromptText(targetVer.text);
        await adapterRef.current.injectPrompt(formatted);
        setIsUndone(verNum === 0);
        setFlowState('injected');
      }
    },
    [versionHistory, setIsUndone, setFlowState]
  );

  const handleReenhance = useCallback(async () => {
    if (isReenhancingRef.current) return;
    isReenhancingRef.current = true;
    isReenhanceCancelledRef.current = false;
    setIsReenhancing(true);

    try {
      const promptId = enhanceResult?.promptId;
      const currentPromptText = adapterRef.current.extractPrompt() || enhanceResult?.enhancedPrompt || '';
      const mode = useEnhanceStore.getState().selectedMode || enhanceResult?.mode || 'general';

      const result: EnhanceResult = await sendMessage('REENHANCE_PROMPT', {
        promptId: promptId || '',
        prompt: currentPromptText,
        mode,
        platform: adapter.getPlatformName(),
      });

      if (isReenhanceCancelledRef.current) {
        console.log('[AURE] Re-enhancement completed after user cancelled. Discarding output.');
        return;
      }

      if (result && result.enhancedPrompt) {
        setEnhanceResult(result);
        const cleanText = formatPromptText(result.enhancedPrompt);
        await adapterRef.current.injectPrompt(cleanText);
        setIsUndone(false);
        setFlowState('injected');
        setIsPromptSaved(false);

        setVersionHistory((prev) => {
          const nextNum = prev.length;
          setActiveVersionNumber(nextNum);
          return [
            ...prev,
            {
              versionNumber: nextNum,
              text: result.enhancedPrompt,
              label: `v${nextNum}-enhanced`,
            },
          ];
        });
      }
    } catch (err) {
      if (isReenhanceCancelledRef.current) return;
      console.error('[AURE] Failed to re-enhance prompt:', err);
    } finally {
      isReenhancingRef.current = false;
      setIsReenhancing(false);
    }
  }, [enhanceResult, adapter, setEnhanceResult, setIsUndone, setFlowState]);

  const handleUndo = useCallback(async () => {
    handleSelectVersion(0);
  }, [handleSelectVersion]);

  const handleReapply = useCallback(async () => {
    if (versionHistory.length > 1) {
      handleSelectVersion(versionHistory.length - 1);
    } else if (enhanceResult?.enhancedPrompt) {
      try {
        await adapterRef.current.injectPrompt(enhanceResult.enhancedPrompt);
        setIsUndone(false);
      } catch (err) {
        console.error('[AURE] Failed to reapply enhanced prompt:', err);
      }
    }
  }, [versionHistory, handleSelectVersion, enhanceResult, setIsUndone]);

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
          onCancel={handleCancelEnhance}
        />
      )}

      {/* Enhancement Mode Selection Panel */}
      {flowState === 'selecting' && (
        <EnhancementModePanel adapter={adapter} onSelectMode={triggerEnhance} />
      )}

      {/* In-Place Enhanced Badge (Version Dropdown / Undo / Re-enhance / Save) */}
      {(flowState === 'injected' || flowState === 'comparing') && enhanceResult && (
        <EnhancedBadge
          adapter={adapter}
          isUndone={isUndone}
          onUndo={handleUndo}
          onReapply={handleReapply}
          onReenhance={handleReenhance}
          onCancelReenhance={handleCancelReenhance}
          isReenhancing={isReenhancing}
          versions={versionHistory}
          currentVersionNumber={activeVersionNumber}
          onSelectVersion={handleSelectVersion}
          onSave={handleSavePrompt}
          isSaved={isPromptSaved}
          onDismiss={() => {
            setVersionHistory([]);
            reset();
          }}
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

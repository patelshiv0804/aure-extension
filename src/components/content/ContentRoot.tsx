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
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';

interface ContentRootProps {
  adapter: SiteAdapter;
}

export const ContentRoot: React.FC<ContentRootProps> = ({ adapter }) => {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
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
  const { isDark } = useTheme();

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



  useEffect(() => {
    const handleStreamMessage = (message: any) => {
      if (
        message?.type === 'ENHANCE_STREAM_TOKEN' &&
        typeof message.payload?.accumulatedText === 'string'
      ) {
        const rawAccumulated = message.payload.accumulatedText;
        useEnhanceStore.getState().setStreamingText(rawAccumulated);
      } else if (
        message?.type === 'ENHANCE_PROGRESS' &&
        typeof message.payload?.progress === 'number'
      ) {
        useEnhanceStore.getState().setStreamProgress(message.payload.progress);
      } else if (
        message?.type === 'ENHANCE_STREAM_DONE' &&
        message.payload?.result
      ) {
        // Stream completed — transition to comparing immediately.
        // This fires BEFORE the background's slow analysis-polling phase,
        // so the UI doesn't have to wait (and the message port doesn't time out).
        const result = message.payload.result as import('@/types/enhancement').EnhanceResult;
        useEnhanceStore.getState().setEnhanceResult(result);
        useEnhanceStore.getState().setStreamProgress(100);
        // Note: triggerEnhance's Promise.allSettled will still resolve
        // (or close the port), but state is already correct so any
        // subsequent setFlowState('comparing') or setFlowState('error')
        // is handled in the catch block below.
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleStreamMessage);
      return () => {
        chrome.runtime.onMessage.removeListener(handleStreamMessage);
      };
    }
  }, []);

  const isEnhancingRef = useRef(false);

  const triggerEnhance = useCallback(
    async (mode: EnhancementMode, role?: string, roleMode?: string) => {
      // 1. Synchronously prevent concurrent enhancement requests
      if (isEnhancingRef.current || useEnhanceStore.getState().flowState === 'enhancing') {
        console.warn('[AURE] Enhance already in progress, ignoring duplicate call');
        return;
      }

      // Auth was already validated by the caller (handleEnhanceClick / shortcut handler).
      // Skipping the duplicate loadAuth() + getStorage('userProfile') calls here
      // saves ~100-300ms of sequential async reads before setFlowState('enhancing').

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
      setFlowState('enhancing');
      useEnhanceStore.getState().setStreamingText('');
      useEnhanceStore.getState().setStreamProgress(0);
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

        if (result.status === 'fulfilled') {
          setEnhanceResult(result.value);
          const orig = result.value.originalPrompt || prompt;
          const cleanText = formatPromptText(result.value.enhancedPrompt);

          // Do NOT auto-inject — user will click "Insert into Chat" in the panel.
          setFlowState('comparing');
          useEnhanceStore.getState().setShowRecommendation(true);

          // Initialize version history: 0 = Original, 1 = v1-enhanced
          setVersionHistory([
            { versionNumber: 0, text: orig, label: 'Original' },
            { versionNumber: 1, text: cleanText, label: 'v1-enhanced' },
          ]);
          setActiveVersionNumber(1);

          // Automatically broadcast history update on successful enhancement
          try {
            chrome.runtime.sendMessage({ type: 'HISTORY_UPDATED', payload: { promptId: result.value.promptId } }).catch(() => {});
            chrome.storage.local.set({ last_history_update: Date.now() }).catch(() => {});
          } catch {}
        } else {
          throw new Error(result.reason?.message ?? 'Enhancement failed');
        }

        if (recommendation.status === 'fulfilled') {
          setRecommendation(recommendation.value);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Enhancement failed';

        // If the Chrome message port closed while we were waiting (happens when
        // the background's analysis-polling phase outlives the port), but we
        // already received the ENHANCE_STREAM_DONE event, the store already has
        // a valid result — just transition to 'comparing' instead of 'error'.
        const isPortClosed =
          message.includes('message port closed') ||
          message.includes('Could not establish connection') ||
          message.includes('Receiving end does not exist') ||
          message.includes('Extension context invalidated');

        const store = useEnhanceStore.getState();

        // ── Priority 1: We already have a streaming result ────────────────
        // ENHANCE_STREAM_DONE already fired and set enhanceResult in the store.
        // Any subsequent error (port-closed OR any other analysis-polling error)
        // should NOT override this — the enhanced text is valid, just show it.
        if (store.enhanceResult) {
          console.warn('[AURE] Error after stream completed, using ENHANCE_STREAM_DONE result:', message);
          const cleanText = formatPromptText(store.enhanceResult.enhancedPrompt);
          setFlowState('comparing');
          useEnhanceStore.getState().setShowRecommendation(true);
          setVersionHistory([
            { versionNumber: 0, text: store.enhanceResult.originalPrompt || prompt, label: 'Original' },
            { versionNumber: 1, text: cleanText, label: 'v1-enhanced' },
          ]);
          setActiveVersionNumber(1);
        } else if (store.streamingText) {
          // ── Priority 2: We have partial streaming text ─────────────────
          console.warn('[AURE] Error but streamingText exists, building fallback result.');
          const cleanText = formatPromptText(store.streamingText);
          const fallbackResult: import('@/types/enhancement').EnhanceResult = {
            promptId: undefined,
            originalPrompt: prompt,
            enhancedPrompt: cleanText,
            mode,
            metrics: {
              clarity: 88, specificity: 90, context: 86, successProbability: 88,
              wordCountOriginal: prompt.split(/\s+/).filter(Boolean).length,
              wordCountEnhanced: cleanText.split(/\s+/).filter(Boolean).length,
              tokenCountOriginal: Math.ceil(prompt.length / 4),
              tokenCountEnhanced: Math.ceil(cleanText.length / 4),
              readabilityOriginal: 60, readabilityEnhanced: 88,
            },
            category: 'general',
            suggestions: [],
            timestamp: Date.now(),
          };
          setEnhanceResult(fallbackResult);
          setFlowState('comparing');
          setVersionHistory([
            { versionNumber: 0, text: prompt, label: 'Original' },
            { versionNumber: 1, text: cleanText, label: 'v1-enhanced' },
          ]);
          setActiveVersionNumber(1);
        } else if (isPortClosed) {
          // ── Priority 3: Port closed with NO result at all ─────────────
          // This means the stream itself never completed. Reset cleanly.
          console.warn('[AURE] Message port closed before any result was received.');
          useEnhanceStore.getState().reset();
        } else {
          // ── Priority 4: Genuine error with no result ───────────────────
          useEnhanceStore.getState().setError(message);
          setFlowState('error');
        }

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
  const [isReenhancing, setIsReenhancing] = useState(false);
  const isReenhancingRef = useRef(false);

  const handleSelectVersion = useCallback(
    async (verNum: number) => {
      const targetVer = versionHistory.find((v) => v.versionNumber === verNum);
      if (targetVer) {
        setActiveVersionNumber(verNum);
        const textToInject = verNum === 0 ? targetVer.text : formatPromptText(targetVer.text);
        await adapterRef.current.injectPrompt(textToInject);
        setIsUndone(verNum === 0);
        setFlowState('injected');
      }
    },
    [versionHistory, setIsUndone, setFlowState]
  );

  const handleReenhance = useCallback(async () => {
    if (isReenhancingRef.current) return;
    isReenhancingRef.current = true;
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

      if (result && result.enhancedPrompt) {
        setEnhanceResult(result);
        const cleanText = formatPromptText(result.enhancedPrompt);
        await adapterRef.current.injectPrompt(cleanText);
        setIsUndone(false);
        setFlowState('injected');

        // Automatically broadcast history update on successful re-enhancement
        try {
          chrome.runtime.sendMessage({ type: 'HISTORY_UPDATED', payload: { promptId: result.promptId || promptId } }).catch(() => {});
          chrome.storage.local.set({ last_history_update: Date.now() }).catch(() => {});
        } catch {}

        setVersionHistory((prev) => {
          const nextNum = prev.length;
          setActiveVersionNumber(nextNum);
          return [
            ...prev,
            {
              versionNumber: nextNum,
              text: cleanText,
              label: `v${nextNum}-enhanced`,
            },
          ];
        });
      }
    } catch (err) {
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
        await adapterRef.current.injectPrompt(formatPromptText(enhanceResult.enhancedPrompt));
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
          isReenhancing={isReenhancing}
          versions={versionHistory}
          currentVersionNumber={activeVersionNumber}
          onSelectVersion={handleSelectVersion}
          onDismiss={() => {
            setVersionHistory([]);
            reset();
          }}
        />
      )}

      {/* Comparison Panel (Side-by-side modal: open during enhancing & comparing) */}
      {(flowState === 'enhancing' || flowState === 'comparing') && (
        <ErrorBoundary name="ComparisonPanel">
          <ComparisonPanel
            adapter={adapter}
            onAccept={handleInjectPrompt}
            onReject={() => {
              // Since we no longer auto-inject, 'Close' just resets to idle.
              // The prompt in the textarea is still the original — user chose not to insert.
              reset();
            }}
          />
        </ErrorBoundary>
      )}

      {/* Model Recommendation & Top-Right Score Card */}
      <ErrorBoundary name="ModelRecommendation">
        <ModelRecommendation adapter={adapter} />
      </ErrorBoundary>
    </>
  );
};

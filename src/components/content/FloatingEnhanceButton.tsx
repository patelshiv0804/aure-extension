// ──────────────────────────────────────────────────────────────
// FloatingEnhanceButton — Premium floating orb capsule
// ──────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { getComposerRect, getRightAnchor } from '@/lib/composer-anchor';
import { useEnhanceStore } from '@/stores/enhance.store';
import { useAuthStore } from '@/stores/auth.store';
import { sendMessage } from '@/lib/messaging';
import { RoleIcon } from '../common/RoleIcon';

interface FloatingEnhanceButtonProps {
  adapter: SiteAdapter;
  onEnhance: () => void;
  onOpenHistory?: () => void;
}

const BUTTON_HEIGHT = 36;
const BUTTON_WIDTH = 175;
const ENHANCING_BUTTON_WIDTH = 265;

const getEnhanceStage = (pct: number) => {
  if (pct < 25) return 'Matching Template';
  if (pct < 65) return 'Optimizing Prompt';
  if (pct < 85) return 'Analyzing Quality';
  return 'Finalizing';
};

export const FloatingEnhanceButton: React.FC<FloatingEnhanceButtonProps> = ({
  adapter,
  onEnhance,
  onOpenHistory,
}) => {
  const { flowState, setFlowState, error } = useEnhanceStore();
  const { isAuthenticated, loadAuth } = useAuthStore();
  const [position, setPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [isMainHovered, setIsMainHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState('Initializing');
  const buttonRef = useRef<HTMLDivElement>(null);
  const lastValidPosition = useRef<{ x: number; y: number; width: number } | null>(null);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  // Real-time backend SSE progress listener (10%, 25%, 55%, 80%, 95%, 100%)
  useEffect(() => {
    if (flowState !== 'enhancing') {
      setProgress(0);
      setStageLabel('Initializing');
      return;
    }

    // Initial starting progress
    setProgress(10);
    setStageLabel('Analyzing Requirements');

    const messageListener = (message: any) => {
      if (message && message.type === 'ENHANCE_PROGRESS' && message.payload) {
        const { progress: realProgress, stage, message: stepMessage } = message.payload;
        if (typeof realProgress === 'number') {
          setProgress(realProgress);
        }
        if (stepMessage) {
          setStageLabel(stepMessage);
        } else if (stage) {
          if (stage === 'INIT') setStageLabel('Analyzing Requirements');
          else if (stage === 'TEMPLATE') setStageLabel('Matching Template');
          else if (stage === 'OPTIMIZING') setStageLabel('Optimizing Prompt');
          else if (stage === 'SCORING') setStageLabel('Scoring Quality');
          else if (stage === 'COMPARING') setStageLabel('Finalizing Analysis');
          else if (stage === 'COMPLETE') setStageLabel('Complete');
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [flowState]);

  // Real-time auth sync: clear auth error when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      const errStr = (error || '').toLowerCase();
      if (flowState === 'error' && (errStr.includes('sign in') || errStr.includes('logged in') || errStr.includes('401'))) {
        setFlowState('idle');
        useEnhanceStore.getState().setError(null);
      }
    }
  }, [isAuthenticated, flowState, error, setFlowState]);

  const activeWidth = flowState === 'enhancing' ? ENHANCING_BUTTON_WIDTH : BUTTON_WIDTH;

  const computePosition = useCallback(() => {
    // Anchor to the SAME composer rect the EnhancedBadge uses, so the two
    // capsules line up with each other and sit inset from the composer's
    // RIGHT border (symmetric with the left capsule).
    const rect = getComposerRect(adapter);

    if (!rect || rect.width === 0) {
      if (lastValidPosition.current) {
        setPosition(lastValidPosition.current);
      }
      return;
    }

    const { top, left } = getRightAnchor(rect, activeWidth);
    const next = { x: left, y: top, width: activeWidth };
    lastValidPosition.current = next;
    setPosition(next);
  }, [adapter, activeWidth]);

  useEffect(() => {
    computePosition();

    const bootTimers = [50, 150, 300].map((d) => setTimeout(computePosition, d));

    let resizeObserver: ResizeObserver | null = null;
    const inputEl = (adapter as any).currentInput ?? (adapter as any).detectInput?.();
    if (inputEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        computePosition();
      });
      resizeObserver.observe(inputEl);
    }

    const fallbackInterval = setInterval(computePosition, 2000);

    window.addEventListener('scroll', computePosition, { passive: true });
    window.addEventListener('resize', computePosition, { passive: true });

    return () => {
      bootTimers.forEach(clearTimeout);
      resizeObserver?.disconnect();
      clearInterval(fallbackInterval);
      window.removeEventListener('scroll', computePosition);
      window.removeEventListener('resize', computePosition);
    };
  }, [computePosition, adapter]);

  const handleHistoryClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onOpenHistory) {
      onOpenHistory();
    } else {
      sendMessage('OPEN_SIDE_PANEL', undefined).catch((err) => {
        console.error('[AURE] Failed to open side panel:', err);
      });
    }
  };

  const handleMainClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (flowState === 'enhancing') return;
    if (!isAuthenticated) {
      useEnhanceStore.getState().setError('You are not logged in. Please sign in to enhance prompts.');
      setFlowState('error');
      handleHistoryClick(e);
      setTimeout(() => {
        if (useEnhanceStore.getState().flowState === 'error') {
          useEnhanceStore.getState().reset();
        }
      }, 4000);
      return;
    }
    onEnhance();
  };

  const handleModeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (flowState === 'enhancing') return;
    setFlowState('selecting');
  };


  const getButtonContent = () => {
    switch (flowState) {
      case 'injected':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 700, fontSize: 12 }}>
            <RoleIcon name="Check" size={15} strokeWidth={2.5} />
            <span>Done!</span>
          </div>
        );
      case 'error':
        const errStr = (error || '').toLowerCase();
        const isAuthErr =
          !isAuthenticated ||
          errStr.includes('sign in') ||
          errStr.includes('logged in') ||
          errStr.includes('401') ||
          errStr.includes('unauthorized');

        if (isAuthErr) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#7C5CFC', fontWeight: 700, fontSize: 11 }}>
              <RoleIcon name="Lock" size={13} strokeWidth={2.2} />
              <span>Please Sign In</span>
            </div>
          );
        }

        const isEmptyPromptError =
          errStr.includes('enter a prompt') ||
          errStr.includes('empty prompt') ||
          errStr.includes('enter text');

        if (isEmptyPromptError) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#F59E0B', fontWeight: 700, fontSize: 11 }}>
              <RoleIcon name="AlertCircle" size={14} strokeWidth={2.2} />
              <span>Enter Prompt</span>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', fontWeight: 700, fontSize: 12 }}>
            <RoleIcon name="X" size={15} strokeWidth={2.5} />
            <span>Failed</span>
          </div>
        );
      default:
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img
              src={chrome.runtime.getURL('logo.png')}
              alt="AURE"
              style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isMainHovered ? '#7C5CFC' : '#1E1B4B',
                letterSpacing: '-0.01em',
                transition: 'color 0.15s ease',
              }}
            >
              Enhance
            </span>
            <span style={{ color: isMainHovered ? '#7C5CFC' : '#9D7BFF', fontSize: 11, marginLeft: 1, transition: 'color 0.15s ease' }}>
              ✦
            </span>
          </div>
        );
    }
  };

  if (!position) return null;

  const errStr = (error || '').toLowerCase();
  const isAuthError =
    flowState === 'error' &&
    (errStr.includes('sign in') ||
      errStr.includes('logged in') ||
      errStr.includes('401') ||
      errStr.includes('unauthorized'));

  const roundedPct = Math.round(progress);

  return (
    <AnimatePresence>
      <motion.div
        ref={buttonRef}
        key="pe-toolbar"
        initial={{ opacity: 0, y: 4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 2147483647,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          height: BUTTON_HEIGHT,
          padding: flowState === 'enhancing' ? '3px 6px 3px 10px' : '3px 4px 3px 6px',
          borderRadius: '20px',
          background: '#FFFFFF',
          border: flowState === 'enhancing' ? '1px solid rgba(167, 139, 250, 0.6)' : '1px solid rgba(236, 233, 255, 0.9)',
          boxShadow: flowState === 'enhancing'
            ? '0 6px 20px rgba(124, 92, 252, 0.15), 0 2px 6px rgba(0,0,0,0.04)'
            : '0 4px 16px rgba(124, 92, 252, 0.08), 0 2px 6px rgba(0,0,0,0.04)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          userSelect: 'none',
          overflow: 'hidden',
          minWidth: flowState === 'enhancing' ? ENHANCING_BUTTON_WIDTH : undefined,
        }}
      >
        {/* Floating Notification Banner if user is not logged in */}
        {isAuthError && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              marginBottom: 8,
              right: 0,
              whiteSpace: 'nowrap',
              background: '#171A2B',
              color: '#FFFFFF',
              padding: '7px 12px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 2147483647,
            }}
          >
            <span style={{ color: '#F43F5E' }}>⚠️</span>
            <span>You are not logged in.</span>
            <button
              onClick={handleHistoryClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={{
                background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
                color: '#FFFFFF',
                border: 'none',
                padding: '3px 9px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign In Now →
            </button>
          </motion.div>
        )}

        {/* Floating Notification Banner for Empty Prompt / Other Errors */}
        {flowState === 'error' && !isAuthError && error && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              marginBottom: 8,
              right: 0,
              whiteSpace: 'nowrap',
              background: '#171A2B',
              color: '#FFFFFF',
              padding: '7px 12px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 2147483647,
              border: '1px solid rgba(245, 158, 11, 0.4)',
            }}
          >
            <span style={{ color: '#F59E0B' }}>⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}

        {/* Enhancing State: Animated Percentage + Progress Bar + Cancel Button */}
        {flowState === 'enhancing' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
            {/* Progress indicator & Percentage text */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span className="pe-spinner" style={{ display: 'inline-flex', color: '#7C5CFC' }}>
                <RoleIcon name="Loader2" size={14} strokeWidth={2.5} />
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E1B4B', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                {stageLabel}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#7C5CFC',
                  background: 'rgba(124, 92, 252, 0.09)',
                  border: '1px solid rgba(124, 92, 252, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '6px',
                  minWidth: 32,
                  textAlign: 'center',
                }}
              >
                {roundedPct}%
              </span>
            </div>
          
        </div>
        ) : (
          /* Normal State: Mode selector + History icon + Enhance button */
          <>
            {/* Minimal Mode / Role Icon Button */}
            <button
              onClick={handleModeClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="Choose Role & Mode"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '14px',
                background: 'transparent',
                border: 'none',
                color: '#A78BFA',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F5F3FF';
                e.currentTarget.style.color = '#7C5CFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#A78BFA';
              }}
            >
              <RoleIcon name="SlidersHorizontal" size={15} strokeWidth={1.8} />
            </button>

            {/* Minimal History Icon Button */}
            <button
              onClick={handleHistoryClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="History & Workspaces"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '14px',
                background: 'transparent',
                border: 'none',
                color: '#A78BFA',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: 0,
                marginRight: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F5F3FF';
                e.currentTarget.style.color = '#7C5CFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#A78BFA';
              }}
            >
              <RoleIcon name="History" size={15} strokeWidth={1.8} />
            </button>

            {/* Vertical divider */}
            <div style={{ width: 1, height: 16, background: '#ECE9FF', marginRight: 4 }} />

            {/* Main AURE / Enhance Orb Button */}
            <button
              onClick={handleMainClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseEnter={() => setIsMainHovered(true)}
              onMouseLeave={() => setIsMainHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 28,
                padding: '0 10px',
                borderRadius: '14px',
                background: isMainHovered ? 'linear-gradient(135deg, #F3F0FF, #EDE9FE)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                whiteSpace: 'nowrap',
              }}
            >
              {getButtonContent()}
            </button>
          </>
        )}

        {/* Smooth Bottom Percentage Progress Bar */}
        {flowState === 'enhancing' && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(124, 92, 252, 0.12)',
              borderRadius: '0 0 20px 20px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #7C5CFC 0%, #A78BFA 50%, #10B981 100%)',
                width: `${roundedPct}%`,
                transition: 'width 0.12s ease-out',
                boxShadow: '0 0 8px rgba(124, 92, 252, 0.6)',
              }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};


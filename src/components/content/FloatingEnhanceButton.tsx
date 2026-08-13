// ──────────────────────────────────────────────────────────────
// FloatingEnhanceButton — Premium floating toolbar
// ──────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { sendMessage } from '@/lib/messaging';
import { RoleIcon } from '../common/RoleIcon';

interface FloatingEnhanceButtonProps {
  adapter: SiteAdapter;
  onEnhance: () => void;
  onOpenHistory?: () => void;
}

const BUTTON_HEIGHT = 40;
const BUTTON_WIDTH = 210;

export const FloatingEnhanceButton: React.FC<FloatingEnhanceButtonProps> = ({
  adapter,
  onEnhance,
  onOpenHistory,
}) => {
  const { flowState, setFlowState } = useEnhanceStore();
  const [position, setPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  // Keep last known valid position so the button doesn't vanish during brief rect misses
  const lastValidPosition = useRef<{ x: number; y: number; width: number } | null>(null);

  const computePosition = useCallback(() => {
    const rect = adapter.getInputRect();

    // No rect yet — fall back to last known good position to avoid flickering
    if (!rect || rect.width === 0) {
      if (lastValidPosition.current) {
        setPosition(lastValidPosition.current);
      }
      return;
    }

    // Walk up from the input element to find the outer input container
    // (the full box including action buttons like mic/send).
    const input = (adapter as any).currentInput ?? (adapter as any).detectInput?.();
    let containerRect = rect;
    if (input) {
      let el: HTMLElement | null = input;
      for (let i = 0; i < 6 && el; i++) {
        const parent = el.parentElement;
        if (parent) {
          const pRect = parent.getBoundingClientRect();
          if (pRect.width > containerRect.width * 1.1 && pRect.width < window.innerWidth * 0.9) {
            containerRect = pRect;
            break;
          }
        }
        el = parent;
      }
    }

    const x = containerRect.right - BUTTON_WIDTH;
    const y = containerRect.top - BUTTON_HEIGHT - 4;

    // Reject positions that are completely off-screen (avoid invisible placements)
    if (
      x < 0 ||
      y < -BUTTON_HEIGHT || // allow slightly above viewport for smooth animation
      x > window.innerWidth ||
      y > window.innerHeight
    ) {
      // Off-screen — keep last valid if available
      if (lastValidPosition.current) {
        setPosition(lastValidPosition.current);
      }
      return;
    }

    const next = { x, y, width: BUTTON_WIDTH };
    lastValidPosition.current = next;
    setPosition(next);
  }, [adapter]);

  useEffect(() => {
    // Run immediately
    computePosition();

    // Poll faster (150ms) to catch layout shifts quickly on SPA pages
    const interval = setInterval(computePosition, 150);

    // Also update on scroll / resize
    window.addEventListener('scroll', computePosition, { passive: true });
    window.addEventListener('resize', computePosition, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', computePosition);
      window.removeEventListener('resize', computePosition);
    };
  }, [computePosition]);

  const handleHistoryClick = () => {
    if (onOpenHistory) {
      onOpenHistory();
    } else {
      sendMessage('OPEN_SIDE_PANEL', undefined).catch((err) => {
        console.error('[AURE] Failed to open side panel:', err);
      });
    }
  };

  const getButtonContent = () => {
    switch (flowState) {
      case 'enhancing':
        return (
          <>
            <span className="pe-spinner" style={{ display: 'inline-flex' }}>
              <RoleIcon name="Loader2" size={18} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Enhancing…</span>
          </>
        );
      case 'injected':
        return (
          <>
            <span style={{ color: '#34D399' }}>
              <RoleIcon name="Check" size={18} strokeWidth={2.5} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#34D399' }}>Done!</span>
          </>
        );
      case 'error':
        return (
          <>
            <span style={{ color: '#ef4444' }}>
              <RoleIcon name="X" size={18} strokeWidth={2.5} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#ef4444' }}>Failed</span>
          </>
        );
      default:
        return (
          <>
            <img
              src={chrome.runtime.getURL('logo.png')}
              alt="AURE"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
            />
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>AURE</span>
          </>
        );
    }
  };

  if (!position) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={buttonRef}
        key="pe-toolbar"
        initial={{ opacity: 0, scaleY: 0.8, transformOrigin: 'bottom' }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0, scaleY: 0.8 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 2147483647,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'stretch',
          height: BUTTON_HEIGHT,
          borderTop: '1px solid #ECE9FF',
          borderLeft: '1px solid #ECE9FF',
          borderRight: '1px solid #ECE9FF',
          borderBottom: 'none',
          borderRadius: '14px 14px 0 0',
          background: '#FFFFFF',
          overflow: 'hidden',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: '#7C5CFC',
          boxShadow: '0 -4px 16px rgba(124, 92, 252, 0.08), 0 -1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Role selector button */}
        <button
          onClick={() => setFlowState('selecting')}
          title="Change enhancement role"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: '100%',
            background: 'transparent',
            border: 'none',
            borderRight: '1px solid #ECE9FF',
            color: '#A78BFA',
            cursor: 'pointer',
            transition: 'all 0.15s',
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
          <RoleIcon name="SlidersHorizontal" size={18} strokeWidth={1.75} />
        </button>

        {/* History button */}
        <button
          onClick={handleHistoryClick}
          title="View prompt history"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: '100%',
            background: 'transparent',
            border: 'none',
            borderRight: '1px solid #ECE9FF',
            color: '#A78BFA',
            cursor: 'pointer',
            transition: 'all 0.15s',
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
          <RoleIcon name="History" size={18} strokeWidth={1.75} />
        </button>

        {/* Enhance button */}
        <button
          onClick={onEnhance}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: '100%',
            flex: 1,
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#7C5CFC',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            padding: '0 14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F5F3FF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {getButtonContent()}
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

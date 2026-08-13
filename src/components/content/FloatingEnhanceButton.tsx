// ──────────────────────────────────────────────────────────────
// FloatingEnhanceButton — Premium floating orb capsule
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

const BUTTON_HEIGHT = 36;
const BUTTON_WIDTH = 175;

export const FloatingEnhanceButton: React.FC<FloatingEnhanceButtonProps> = ({
  adapter,
  onEnhance,
  onOpenHistory,
}) => {
  const { flowState, setFlowState } = useEnhanceStore();
  const [position, setPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [isMainHovered, setIsMainHovered] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const lastValidPosition = useRef<{ x: number; y: number; width: number } | null>(null);

  const computePosition = useCallback(() => {
    const rect = adapter.getInputRect();

    if (!rect || rect.width === 0) {
      if (lastValidPosition.current) {
        setPosition(lastValidPosition.current);
      }
      return;
    }

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
    const y = containerRect.top - BUTTON_HEIGHT - 6;

    if (
      x < 0 ||
      y < -BUTTON_HEIGHT ||
      x > window.innerWidth ||
      y > window.innerHeight
    ) {
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
    computePosition();
    const interval = setInterval(computePosition, 150);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7C5CFC', fontWeight: 600, fontSize: 12 }}>
            <span className="pe-spinner" style={{ display: 'inline-flex' }}>
              <RoleIcon name="Loader2" size={15} strokeWidth={2.2} />
            </span>
            <span>Enhancing…</span>
          </div>
        );
      case 'injected':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 700, fontSize: 12 }}>
            <RoleIcon name="Check" size={15} strokeWidth={2.5} />
            <span>Done!</span>
          </div>
        );
      case 'error':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', fontWeight: 700, fontSize: 12 }}>
            <RoleIcon name="X" size={15} strokeWidth={2.5} />
            <span>Failed</span>
          </div>
        );
      default:
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease' }}>
            {isMainHovered ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#7C5CFC' }}>
                <span style={{ color: '#9D7BFF' }}>✦</span> Enhance
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#1E1B4B' }}>
                <img
                  src={chrome.runtime.getURL('logo.png')}
                  alt="AURE"
                  style={{ width: 16, height: 16, objectFit: 'contain' }}
                />
                <span style={{ letterSpacing: '-0.02em' }}>AURE</span>
                <span style={{ color: '#9D7BFF', fontSize: 11, marginLeft: 1 }}>✦</span>
              </span>
            )}
          </div>
        );
    }
  };

  if (!position) return null;

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
          padding: '3px 4px 3px 6px',
          borderRadius: '20px',
          background: '#FFFFFF',
          border: '1px solid rgba(236, 233, 255, 0.9)',
          boxShadow: '0 4px 16px rgba(124, 92, 252, 0.08), 0 2px 6px rgba(0,0,0,0.04)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          userSelect: 'none',
        }}
      >
        {/* Minimal Mode / Role Icon Button */}
        <button
          onClick={() => setFlowState('selecting')}
          title="Mode"
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
          title="History"
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
          onClick={onEnhance}
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
      </motion.div>
    </AnimatePresence>
  );
};

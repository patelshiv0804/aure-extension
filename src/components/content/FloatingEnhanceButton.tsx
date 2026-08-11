// ──────────────────────────────────────────────────────────────
// FloatingEnhanceButton — Premium floating toolbar
// ──────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
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

export const FloatingEnhanceButton: React.FC<FloatingEnhanceButtonProps> = ({
  adapter,
  onEnhance,
  onOpenHistory,
}) => {
  const { flowState, setFlowState } = useEnhanceStore();
  const [position, setPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const rect = adapter.getInputRect();
      if (rect && rect.width > 0) {
        // Walk up from the input element to find the outer input container
        // (the full box including action buttons like mic/send).
        const input = (adapter as any).currentInput ?? (adapter as any).detectInput?.();
        let containerRect = rect;
        if (input) {
          let el: HTMLElement | null = input;
          // Walk up a few levels to find a container that is wider than the text input
          for (let i = 0; i < 6 && el; i++) {
            const parent = el.parentElement;
            if (parent) {
              const pRect = parent.getBoundingClientRect();
              // Use the parent if it is wider and still a reasonable container
              if (pRect.width > containerRect.width * 1.1 && pRect.width < window.innerWidth * 0.9) {
                containerRect = pRect;
                break;
              }
            }
            el = parent;
          }
        }
        const buttonWidth = 210;
        setPosition({
          x: containerRect.right - buttonWidth,
          y: containerRect.top - BUTTON_HEIGHT - 4,
          width: buttonWidth,
        });
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 400);
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [adapter]);

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


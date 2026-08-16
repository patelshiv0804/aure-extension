// ──────────────────────────────────────────────────────────────
// EnhancedBadge — Floating badge after in-place prompt enhancement
// Provides quick Undo, optional Compare modal trigger, and Dismiss
// ──────────────────────────────────────────────────────────────

import React, { useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { RoleIcon } from '../common/RoleIcon';

interface EnhancedBadgeProps {
  adapter: SiteAdapter;
  isUndone: boolean;
  onUndo: () => void;
  onReapply: () => void;
  onCompare: () => void;
  onDismiss: () => void;
}

export const EnhancedBadge: React.FC<EnhancedBadgeProps> = ({
  adapter,
  isUndone,
  onUndo,
  onReapply,
  onCompare,
  onDismiss,
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Measure position on mount & window scroll/resize
  useLayoutEffect(() => {
    const updatePos = () => {
      const rect = adapter.getInputRect();
      if (!rect) return;
      setPos({ top: Math.max(12, rect.top - 46), left: rect.left });
    };

    updatePos();

    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [adapter]);

  if (!pos) return null;
  const { top, left } = pos;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          position: 'fixed',
          left,
          top,
          zIndex: 2147483645,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 36,
          padding: '0 12px 0 10px',
          borderRadius: 18,
          background: '#FFFFFF',
          border: '1px solid #ECE9FF',
          boxShadow: '0 4px 20px rgba(124, 92, 252, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* ✨ Enhanced / Undone Label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            paddingRight: 8,
            borderRight: '1px solid #ECE9FF',
          }}
        >
          <span style={{ fontSize: 13, color: isUndone ? '#64748B' : '#7C5CFC' }}>
            {isUndone ? '↩' : '✨'}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: isUndone ? '#64748B' : '#7C5CFC',
              letterSpacing: '-0.01em',
            }}
          >
            {isUndone ? 'Original' : 'Enhanced'}
          </span>
        </div>

        {/* Undo or Retain Enhanced Prompt Action */}
        {isUndone ? (
          <button
            onClick={onReapply}
            title="Retain / reapply enhanced prompt"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              height: 26,
              padding: '0 10px',
              borderRadius: 13,
              background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124, 92, 252, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 92, 252, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 92, 252, 0.25)';
            }}
          >
            <RoleIcon name="Sparkles" size={12} strokeWidth={2.2} />
            <span>Retain Enhanced Prompt</span>
          </button>
        ) : (
          <button
            onClick={onUndo}
            title="Revert to original text"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 26,
              padding: '0 8px',
              borderRadius: 13,
              background: '#F5F3FF',
              border: 'none',
              color: '#6D28D9',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EDE9FE';
              e.currentTarget.style.color = '#5B21B6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F5F3FF';
              e.currentTarget.style.color = '#6D28D9';
            }}
          >
            <RoleIcon name="RotateCcw" size={12} strokeWidth={2.2} />
            <span>Undo</span>
          </button>
        )}

        {/* Compare Action */}
        <button
          onClick={onCompare}
          title="Compare original vs enhanced side-by-side"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            padding: '0 8px',
            borderRadius: 13,
            background: 'transparent',
            border: '1px solid #ECE9FF',
            color: '#64748B',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F8FAFC';
            e.currentTarget.style.color = '#334155';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#64748B';
          }}
        >
          <RoleIcon name="Layers" size={12} strokeWidth={2} />
          <span>Compare</span>
        </button>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          title="Dismiss toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 11,
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            marginLeft: 2,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F1F5F9';
            e.currentTarget.style.color = '#475569';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94A3B8';
          }}
        >
          <RoleIcon name="X" size={13} strokeWidth={2} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

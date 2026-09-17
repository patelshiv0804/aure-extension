// ──────────────────────────────────────────────────────────────
// EnhancementDepthControl — Segmented Pill Control for Enhancement Depth
// Options: Auto, Minimal, Standard, Deep
// Matches Prompt_Enhancer-FE styling with animated active indicator
// ──────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Feather, Sparkles, Layers, type LucideIcon } from 'lucide-react';
import type { EnhancementLevel } from '@/types/enhancement';
import { useTheme } from '@/hooks/useTheme';

export interface DepthOption {
  id: EnhancementLevel;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const DEPTH_OPTIONS: DepthOption[] = [
  {
    id: 'auto',
    label: 'Auto',
    icon: Zap,
    description: 'Auto-detects ideal depth based on length & structural complexity',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    icon: Feather,
    description: 'Light polish: fixes grammar, tone, and clarity while keeping original structure',
  },
  {
    id: 'standard',
    label: 'Standard',
    icon: Sparkles,
    description: 'Balanced optimization: assigns role, context, structure, and constraints',
  },
  {
    id: 'deep',
    label: 'Deep',
    icon: Layers,
    description: 'Comprehensive transformation: multi-step reasoning chain, edge cases, strict constraints',
  },
];

interface EnhancementDepthControlProps {
  value: EnhancementLevel;
  onChange: (level: EnhancementLevel) => void;
  disabled?: boolean;
  showTitle?: boolean;
  compact?: boolean;
  layoutIdPrefix?: string;
}

export const EnhancementDepthControl: React.FC<EnhancementDepthControlProps> = ({
  value,
  onChange,
  disabled = false,
  showTitle = true,
  compact = false,
  layoutIdPrefix = 'depth',
}) => {
  const { isDark, D } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {showTitle && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isDark ? D.textMuted : '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
            }}
          >
            Enhancement Depth
          </span>

          {value === 'auto' && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: isDark ? '#A78BFA' : '#7C3AED',
                background: isDark ? 'rgba(139, 92, 246, 0.16)' : 'rgba(124, 58, 237, 0.08)',
                border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(124, 58, 237, 0.18)'}`,
                padding: '1.5px 7px',
                borderRadius: 9999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                lineHeight: 1.3,
              }}
            >
              <Sparkles size={9.5} strokeWidth={2} />
              Auto detection active
            </span>
          )}
        </div>
      )}

      {/* Pill Segmented Bar */}
      <div
        style={{
          display: 'flex',
          position: 'relative',
          background: isDark
            ? 'rgba(14, 13, 20, 0.75)'
            : 'linear-gradient(160deg, rgba(109,40,217,0.08) 0%, rgba(124,58,237,0.03) 100%)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(124, 58, 237, 0.13)'}`,
          borderRadius: 9999,
          padding: 3,
          boxShadow: isDark
            ? 'inset 0 2px 5px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06)'
            : 'inset 0 2px 4px rgba(80,20,180,0.1), inset 0 1px 2px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8)',
          width: '100%',
          gap: 2,
        }}
      >
        {DEPTH_OPTIONS.map(({ id, label, icon: Icon, description }) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              id={`depth-pill-${id}`}
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(id);
              }}
              title={description}
              style={{
                flex: 1,
                height: compact ? 28 : 32,
                padding: compact ? '0 8px' : '0 12px',
                fontSize: compact ? 11.5 : 12.5,
                fontWeight: active ? 700 : 500,
                color: active
                  ? isDark
                    ? '#F5F4F8'
                    : '#6D28D9'
                  : isDark
                  ? D.textMuted
                  : '#64748B',
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                borderRadius: 9999,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 180ms ease',
                userSelect: 'none',
              }}
            >
              {active && (
                <motion.div
                  layoutId={`${layoutIdPrefix}ActivePill`}
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: isDark ? '#232034' : '#FFFFFF',
                    borderRadius: 9999,
                    zIndex: 1,
                    boxShadow: isDark
                      ? '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 8px rgba(80,20,180,0.12), 0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px rgba(124,58,237,0.07)',
                  }}
                />
              )}
              <span
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: compact ? 4 : 5.5,
                }}
              >
                <Icon
                  size={compact ? 12 : 13}
                  strokeWidth={active ? 2.3 : 1.8}
                  style={{
                    opacity: active ? 1 : 0.75,
                    color: active ? (isDark ? '#C084FC' : '#7C3AED') : undefined,
                  }}
                />
                <span>{label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// AppearanceSettings — Apple macOS / Linear 3-Card Theme Selector
// Directly matching Prompt_Enhancer-FE Settings Appearance Component
// ──────────────────────────────────────────────────────────────

import React from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/theme/tokens';

interface AppearanceSettingsProps {
  compact?: boolean;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({ compact = false }) => {
  const { preference, resolvedTheme, isDark, setPreference, D } = useTheme();

  const themes: Array<{
    id: ThemePreference;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    bg: string;
    border: string;
    iconColor: string;
  }> = [
    {
      id: 'light',
      label: 'Light',
      sublabel: 'Clean, radiant daylight palette',
      icon: Sun,
      bg: '#F8FAFC',
      border: '#E2E8F0',
      iconColor: '#F59E0B',
    },
    {
      id: 'dark',
      label: 'Dark',
      sublabel: 'Deep violet near-black canvas (#0A0A0F)',
      icon: Moon,
      bg: '#0F172A',
      border: '#334155',
      iconColor: '#93C5FD',
    },
    {
      id: 'system',
      label: 'Auto (System)',
      sublabel: 'Follows your operating system theme live',
      icon: Laptop,
      bg: 'linear-gradient(135deg, #FFFFFF 50%, #0F172A 50%)',
      border: '#CBD5E1',
      iconColor: '#A855F7',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3
            style={{
              fontSize: compact ? 13 : 15,
              fontWeight: 800,
              color: isDark ? D.textPrimary : '#0F172A',
              margin: 0,
            }}
          >
            Appearance
          </h3>
          {preference === 'system' && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: isDark ? '#C084FC' : '#7C3AED',
                background: isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(124, 58, 237, 0.08)',
                padding: '2px 7px',
                borderRadius: 9999,
              }}
            >
              Active: {resolvedTheme.toUpperCase()}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: compact ? 11 : 13,
            color: isDark ? D.textSecondary : '#64748B',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Select your preferred workspace theme color palette.
        </p>
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: compact ? 'repeat(3, 1fr)' : 'repeat(3, minmax(0, 1fr))',
        }}
      >
        {themes.map((th) => {
          const isSelected = preference === th.id;
          const Icon = th.icon;

          return (
            <button
              key={th.id}
              type="button"
              onClick={() => setPreference(th.id)}
              style={{
                padding: compact ? '10px 8px' : '16px 12px',
                borderRadius: 14,
                border: isSelected
                  ? '2px solid #8B5CF6'
                  : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0'}`,
                background: isSelected
                  ? isDark
                    ? 'rgba(139, 92, 246, 0.15)'
                    : 'rgba(124, 58, 237, 0.04)'
                  : isDark
                  ? 'rgba(20, 19, 32, 0.75)'
                  : '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: compact ? 6 : 10,
                transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isSelected
                  ? '0 4px 14px rgba(139, 92, 246, 0.2)'
                  : isDark
                  ? '0 2px 6px rgba(0,0,0,0.2)'
                  : '0 1px 3px rgba(0,0,0,0.02)',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#8B5CF6';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = isDark
                    ? 'rgba(255, 255, 255, 0.10)'
                    : '#E2E8F0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {/* Preview Window Graphic */}
              <div
                style={{
                  width: compact ? 38 : 50,
                  height: compact ? 26 : 34,
                  borderRadius: 8,
                  background: th.bg,
                  border: `1px solid ${th.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Icon size={compact ? 14 : 17} color={th.iconColor} strokeWidth={2.2} />
              </div>

              {/* Title & Badge */}
              <div className="text-center">
                <span
                  style={{
                    fontSize: compact ? 11 : 13,
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected
                      ? isDark
                        ? '#C084FC'
                        : '#7C3AED'
                      : isDark
                      ? D.textPrimary
                      : '#334155',
                    display: 'block',
                  }}
                >
                  {th.label}
                </span>

                {!compact && (
                  <span
                    style={{
                      fontSize: 10,
                      color: isDark ? D.textMuted : '#94A3B8',
                      display: 'block',
                      marginTop: 2,
                      lineHeight: 1.3,
                    }}
                  >
                    {th.sublabel}
                  </span>
                )}
              </div>

              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#8B5CF6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// EnhancedBadge — Floating badge after in-place prompt enhancement
// Provides version dropdown (v1, v2, etc.), Undo/Reapply, Re-enhance button, and Dismiss
// ──────────────────────────────────────────────────────────────

import React, { useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { RoleIcon } from '../common/RoleIcon';

export interface PromptVersionItem {
  versionNumber: number;
  text: string;
  label?: string;
}

interface EnhancedBadgeProps {
  adapter: SiteAdapter;
  isUndone: boolean;
  onUndo: () => void;
  onReapply: () => void;
  onReenhance?: () => void;
  onCancelReenhance?: () => void;
  isReenhancing?: boolean;
  onDismiss: () => void;
  versions?: PromptVersionItem[];
  currentVersionNumber?: number;
  onSelectVersion?: (versionNumber: number) => void;
  onSave?: () => void;
  isSaved?: boolean;
}

export const EnhancedBadge: React.FC<EnhancedBadgeProps> = ({
  adapter,
  isUndone,
  onUndo,
  onReapply,
  onReenhance,
  onCancelReenhance,
  isReenhancing = false,
  onDismiss,
  versions = [],
  currentVersionNumber = 2,
  onSelectVersion,
  onSave,
  isSaved = false,
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [reenhanceProgress, setReenhanceProgress] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Smooth realistic percentage progress animation while re-enhancing
  useEffect(() => {
    if (!isReenhancing) {
      setReenhanceProgress(0);
      return;
    }

    setReenhanceProgress(15);
    const interval = setInterval(() => {
      setReenhanceProgress((prev) => {
        if (prev >= 95) return Math.min(98, prev + 0.2);
        if (prev >= 80) return Math.min(95, prev + 1.2);
        if (prev >= 50) return Math.min(80, prev + 2.5);
        return Math.min(50, prev + 4.5);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isReenhancing]);


  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isDropdownOpen]);

  // Compute exact position sticking to the top border of the chat area
  const computePosition = useCallback(() => {
    const input = (adapter as any).currentInput ?? (adapter as any).detectInput?.();
    if (!input) {
      const rect = adapter.getInputRect();
      if (rect) {
        setPos({ top: Math.max(12, rect.top - 44), left: Math.max(12, rect.left) });
      }
      return;
    }

    // 1. Locate the outer chat composer container (e.g. form or composer wrapper)
    const composer = input.closest('form, [data-composer-surface="true"], fieldset, div[class*="composer"]');
    let targetRect: DOMRect = composer ? composer.getBoundingClientRect() : input.getBoundingClientRect();

    // 2. Fallback: walk up parents if input rect is too narrow
    if (!composer) {
      let el: HTMLElement | null = input;
      for (let i = 0; i < 6 && el; i++) {
        const parent = el.parentElement;
        if (parent) {
          const pRect = parent.getBoundingClientRect();
          if (pRect.width >= targetRect.width * 1.05 && pRect.width < window.innerWidth * 0.95) {
            targetRect = pRect;
            break;
          }
        }
        el = parent;
      }
    }

    // Position badge right above the top border of the chat composer
    const top = Math.max(12, targetRect.top - 42);
    const left = Math.max(12, targetRect.left + 8);

    setPos({ top, left });
  }, [adapter]);

  useLayoutEffect(() => {
    computePosition();

    const input = (adapter as any).currentInput ?? (adapter as any).detectInput?.();

    let resizeObserver: ResizeObserver | null = null;
    if (input && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        computePosition();
      });
      resizeObserver.observe(input);
      const composer = input.closest('form, [data-composer-surface="true"], fieldset, div[class*="composer"]');
      if (composer) {
        resizeObserver.observe(composer);
      }
    }

    window.addEventListener('scroll', computePosition, true);
    window.addEventListener('resize', computePosition);
    if (input) {
      input.addEventListener('scroll', computePosition, { passive: true });
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', computePosition, true);
      window.removeEventListener('resize', computePosition);
      if (input) {
        input.removeEventListener('scroll', computePosition);
      }
    };
  }, [computePosition, adapter]);

  if (!pos) return null;
  const { top, left } = pos;

  const hasMultipleVersions = versions && versions.length > 1;
  const currentVersion = versions.find((v) => v.versionNumber === currentVersionNumber) || versions[versions.length - 1];
  const currentLabel = currentVersion?.label || (currentVersionNumber === 0 ? 'Original' : `v${currentVersionNumber}-enhanced`);

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
          userSelect: 'none',
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

        {/* Version Dropdown (when multiple versions exist) OR Standard Undo Button */}
        {hasMultipleVersions ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="Select prompt version"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                height: 26,
                padding: '0 10px',
                borderRadius: 13,
                background: isDropdownOpen ? '#EDE9FE' : '#F5F3FF',
                border: '1px solid rgba(124, 92, 252, 0.25)',
                color: '#6D28D9',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#EDE9FE';
              }}
              onMouseLeave={(e) => {
                if (!isDropdownOpen) {
                  e.currentTarget.style.background = '#F5F3FF';
                }
              }}
            >
              <RoleIcon name="RotateCcw" size={11} strokeWidth={2.2} />
              <span>{currentLabel}</span>
              <RoleIcon
                name="ChevronDown"
                size={11}
                strokeWidth={2.5}
                style={{
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {/* Version Selection Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: 0,
                    minWidth: 165,
                    background: '#FFFFFF',
                    borderRadius: 14,
                    border: '1px solid #ECE9FF',
                    boxShadow: '0 10px 30px rgba(124, 92, 252, 0.16), 0 2px 8px rgba(0, 0, 0, 0.06)',
                    padding: 5,
                    zIndex: 2147483647,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      padding: '4px 8px 2px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#94A3B8',
                    }}
                  >
                    Prompt Versions
                  </div>
                  {versions.map((ver) => {
                    const isSelected = currentVersionNumber === ver.versionNumber;
                    const isOriginal = ver.versionNumber === 0;
                    return (
                      <button
                        key={ver.versionNumber}
                        onClick={() => {
                          onSelectVersion?.(ver.versionNumber);
                          setIsDropdownOpen(false);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 9px',
                          borderRadius: 9,
                          border: 'none',
                          background: isSelected ? '#F5F3FF' : 'transparent',
                          color: isSelected ? '#6D28D9' : '#334155',
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'all 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#F8FAFC';
                            e.currentTarget.style.color = '#1E293B';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#334155';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: isSelected ? '#7C5CFC' : '#64748B',
                              background: isSelected ? '#EDE9FE' : '#F1F5F9',
                              padding: '1px 6px',
                              borderRadius: 5,
                            }}
                          >
                            {isOriginal ? 'Original' : `v${ver.versionNumber}`}
                          </span>
                          <span style={{ fontSize: 11.5 }}>
                            {ver.label || (isOriginal ? 'Original' : `v${ver.versionNumber}-enhanced`)}
                          </span>
                        </div>
                        {isSelected && (
                          <span style={{ color: '#7C5CFC', display: 'flex' }}>
                            <RoleIcon name="Check" size={13} strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : isUndone ? (
          <button
            onClick={onReapply}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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

        {/* Explicit Save to Vault Button */}
        {onSave && !isReenhancing && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            disabled={isSaved}
            title={isSaved ? 'Saved to vault & history' : 'Save this enhanced prompt to your vault'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 26,
              padding: '0 9px',
              borderRadius: 13,
              background: isSaved ? '#ECFDF5' : '#F8FAFC',
              border: isSaved ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.8)',
              color: isSaved ? '#059669' : '#475569',
              fontSize: 12,
              fontWeight: 600,
              cursor: isSaved ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSaved) {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.color = '#1E293B';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaved) {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.color = '#475569';
              }
            }}
          >
            <RoleIcon name={isSaved ? 'Check' : 'Bookmark'} size={12} strokeWidth={2.2} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        )}

        {/* Re-enhance Action */}
        <button
          onClick={isReenhancing ? undefined : onReenhance}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          disabled={isReenhancing}
          title={isReenhancing ? 'Re-enhancing in progress' : 'Re-enhance prompt using AI'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            height: 26,
            padding: isReenhancing ? '0 8px' : '0 10px',
            borderRadius: 13,
            background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
            border: '1px solid rgba(167, 139, 250, 0.4)',
            color: '#6D28D9',
            fontSize: 12,
            fontWeight: 600,
            cursor: isReenhancing ? 'default' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isReenhancing) {
              e.currentTarget.style.background = '#EDE9FE';
              e.currentTarget.style.borderColor = '#A78BFA';
              e.currentTarget.style.color = '#5B21B6';
            }
          }}
          onMouseLeave={(e) => {
            if (!isReenhancing) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #F5F3FF, #EDE9FE)';
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)';
              e.currentTarget.style.color = '#6D28D9';
            }
          }}
        >
          {isReenhancing ? (
            <>
              <RoleIcon name="Loader2" size={12} strokeWidth={2.5} className="animate-spin text-purple-600" />
              <span>Re-enhancing</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#7C5CFC',
                  background: 'rgba(124, 92, 252, 0.12)',
                  padding: '1px 4px',
                  borderRadius: 4,
                }}
              >
                {Math.round(reenhanceProgress)}%
              </span>
            </>
          ) : (
            <>
              <RoleIcon name="Sparkles" size={12} strokeWidth={2.2} />
              <span>Re-enhance</span>
            </>
          )}
        </button>

        {/* Cancel Re-enhance button */}
        {isReenhancing && onCancelReenhance && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancelReenhance();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="Cancel re-enhancement"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: '3px 7px',
              height: 24,
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#EF4444',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EF4444';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.color = '#EF4444';
            }}
          >
            <RoleIcon name="X" size={11} strokeWidth={2.5} />
            <span>Cancel</span>
          </button>
        )}

        {/* Dismiss Button */}
        {!isReenhancing && (
          <button
            onClick={onDismiss}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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
        )}

        {/* Bottom progress bar for re-enhancing */}
        {isReenhancing && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2.5,
              background: 'rgba(124, 92, 252, 0.1)',
              borderRadius: '0 0 20px 20px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #7C5CFC, #A78BFA, #10B981)',
                width: `${Math.round(reenhanceProgress)}%`,
                transition: 'width 0.12s ease-out',
              }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

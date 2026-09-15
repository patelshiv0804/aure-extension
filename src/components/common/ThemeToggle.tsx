// ──────────────────────────────────────────────────────────────
// ThemeToggle — Apple-inspired 3-Way Theme Switcher
// Supports Light, Dark, and Auto (System)
// ──────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/theme/tokens';

interface ThemeToggleProps {
  className?: string;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  align = 'right',
  size = 'md',
}) => {
  const { preference, resolvedTheme, isDark, setPreference } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSm = size === 'sm';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDown);
      return () => document.removeEventListener('mousedown', handlePointerDown);
    }
  }, [isOpen]);

  const options: Array<{
    id: ThemePreference;
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  }> = [
    { id: 'light', label: 'Light', description: 'Clean daylight theme', icon: Sun },
    { id: 'dark', label: 'Dark', description: 'Deep violet dark theme', icon: Moon },
    { id: 'system', label: 'Auto (System)', description: 'Follows operating system', icon: Laptop },
  ];

  return (
    <div ref={containerRef} className={`relative inline-block shrink-0 ${className}`}>
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Change theme"
        title={`Theme: ${preference === 'system' ? `Auto (${resolvedTheme})` : preference}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className={`relative flex ${isSm ? 'h-7 w-7' : 'h-8 w-8'} items-center justify-center rounded-full transition-colors cursor-pointer shrink-0`}
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(124, 58, 237, 0.06)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(124, 58, 237, 0.12)'}`,
          color: isDark ? '#FCD34D' : '#6D28D9',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {preference === 'system' ? (
            <motion.span
              key="system-icon"
              initial={{ y: -6, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 6, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center relative"
            >
              {isDark ? (
                <Moon size={isSm ? 13 : 14} strokeWidth={2.2} />
              ) : (
                <Sun size={isSm ? 13 : 15} strokeWidth={2.2} />
              )}
              {/* Subtle badge indicating system auto */}
              <span
                className="absolute -bottom-1 -right-1 w-1.5 h-1.5 rounded-full"
                style={{ background: isDark ? '#C084FC' : '#7C3AED' }}
                title="Following System Theme"
              />
            </motion.span>
          ) : isDark ? (
            <motion.span
              key="moon-icon"
              initial={{ y: -8, opacity: 0, rotate: -90 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 8, opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <Moon size={isSm ? 13 : 15} strokeWidth={2} />
            </motion.span>
          ) : (
            <motion.span
              key="sun-icon"
              initial={{ y: -8, opacity: 0, rotate: 90 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 8, opacity: 0, rotate: -90 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <Sun size={isSm ? 13 : 15} strokeWidth={2} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={`absolute top-full mt-2 w-48 rounded-2xl p-1.5 z-50 shadow-xl ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
            style={{
              background: isDark ? 'rgba(20, 19, 32, 0.96)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(124, 58, 237, 0.12)'}`,
              boxShadow: isDark
                ? '0 12px 36px rgba(0, 0, 0, 0.65)'
                : '0 12px 32px rgba(124, 58, 237, 0.12)',
            }}
          >
            <div className="px-2.5 py-1.5 mb-1 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isDark ? '#ABA9BC' : '#64748B' }}>
                Appearance
              </span>
            </div>

            <div className="space-y-0.5">
              {options.map((opt) => {
                const isSelected = preference === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPreference(opt.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left"
                    style={{
                      background: isSelected
                        ? isDark
                          ? 'rgba(139, 92, 246, 0.18)'
                          : 'rgba(124, 58, 237, 0.08)'
                        : 'transparent',
                      color: isSelected
                        ? isDark
                          ? '#C084FC'
                          : '#7C3AED'
                        : isDark
                        ? '#F5F4F8'
                        : '#1E293B',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(124, 58, 237, 0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: isSelected
                            ? isDark
                              ? 'rgba(139, 92, 246, 0.25)'
                              : 'rgba(124, 58, 237, 0.12)'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(0, 0, 0, 0.04)',
                          color: isSelected
                            ? isDark
                              ? '#C084FC'
                              : '#7C3AED'
                            : isDark
                            ? '#ABA9BC'
                            : '#64748B',
                        }}
                      >
                        <Icon size={13} strokeWidth={2.2} />
                      </div>
                      <div>
                        <div className="text-[12px] font-bold leading-tight">{opt.label}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        strokeWidth={2.6}
                        style={{ color: isDark ? '#C084FC' : '#7C3AED' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

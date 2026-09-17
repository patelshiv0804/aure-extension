// ──────────────────────────────────────────────────────────────
// PopupRoot — Apple macOS / iOS Inspired Extension Launcher
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/hooks/useTheme';
import { sendMessage } from '@/lib/messaging';
import type { Prompt } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';
import { ThemeToggle } from '../common/ThemeToggle';
import { Sparkles } from 'lucide-react';

export const PopupRoot: React.FC = () => {
  const { user, isAuthenticated, loadAuth, logout } = useAuthStore();
  const { isDark, D, L } = useTheme();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [recentPrompt, setRecentPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  // Fetch most recent prompt
  useEffect(() => {
    const fetchRecent = async () => {
      if (!isAuthenticated) {
        setRecentPrompt(null);
        return;
      }
      try {
        const result = await sendMessage('GET_HISTORY', { limit: 1 });
        if (result.prompts?.length) setRecentPrompt(result.prompts[0]);
        else setRecentPrompt(null);
      } catch { /* silent */ }
    };
    fetchRecent();
  }, [isAuthenticated]);

  const handleOpenSidePanel = async (tabName?: string | React.MouseEvent) => {
    try {
      const validTabs = ['history', 'analytics', 'context', 'settings'];
      if (typeof tabName === 'string' && validTabs.includes(tabName)) {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ targetSidePanelTab: tabName });
        }
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      }
    } catch (e) {
      console.error('Failed to open side panel:', e);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div
      className="w-[350px] select-none font-sans overflow-hidden flex flex-col transition-colors duration-200"
      style={{
        background: isDark ? D.bg : L.bg,
        color: isDark ? D.textPrimary : L.textPrimary,
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b gap-2"
        style={{ borderColor: isDark ? D.border : 'rgba(236, 233, 255, 0.8)' }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            className="w-7 h-7 object-contain drop-shadow-xs shrink-0"
            alt="AURE Logo"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <h1 className="text-sm font-bold tracking-tight shrink-0" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
              AURE
            </h1>
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 shrink-0"
              style={{
                background: isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF',
                color: isDark ? '#C084FC' : '#7C3AED',
                border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.15)'}`,
              }}
            >
              <Sparkles size={8} /> Pro
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Theme Toggle */}
          <ThemeToggle align="right" size="sm" />

          {isAuthenticated && user ? (
            <div className="relative shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenSidePanel}
                  className="flex items-center gap-1 px-2 py-1 rounded-full transition-all text-xs font-semibold shadow-2xs cursor-pointer shrink-0"
                  style={{
                    background: isDark ? D.surface : '#FFFFFF',
                    border: `1px solid ${isDark ? D.border : '#E2E8F0'}`,
                    color: isDark ? D.textPrimary : '#334155',
                  }}
                  title={user.email}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="max-w-[55px] truncate text-[11px] font-bold">
                    {user.display_name || user.email.split('@')[0]}
                  </span>
                </button>

                <button
                  onClick={() => setShowSignOutConfirm(!showSignOutConfirm)}
                  className="w-7 h-7 rounded-full transition-all flex items-center justify-center shadow-2xs shrink-0 cursor-pointer"
                  style={{
                    background: isDark ? 'rgba(244, 63, 94, 0.15)' : '#FFF1F2',
                    color: '#F43F5E',
                    border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.3)' : 'rgba(254, 205, 211, 0.7)'}`,
                  }}
                  title="Sign Out"
                >
                  <RoleIcon name="LogOut" size={13} strokeWidth={2} />
                </button>
              </div>

              {/* Two-step Sign Out Confirmation Popover */}
              <AnimatePresence>
                {showSignOutConfirm && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 4 }}
                    className="absolute right-0 top-full mt-2 w-60 p-3.5 rounded-2xl shadow-xl z-50 text-left"
                    style={{
                      background: isDark ? '#141320' : '#FFFFFF',
                      border: `1px solid ${isDark ? D.border : '#E2E8F0'}`,
                      boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.65)' : '0 10px 25px rgba(0,0,0,0.12)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="p-2 rounded-xl shrink-0"
                        style={{
                          background: isDark ? 'rgba(244, 63, 94, 0.18)' : '#FFF1F2',
                          color: '#F43F5E',
                        }}
                      >
                        <RoleIcon name="LogOut" size={15} strokeWidth={2} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                          Sign Out of AURE?
                        </h4>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                          Are you sure you want to sign out of <strong style={{ color: isDark ? '#C084FC' : '#334155' }}>{user.email}</strong>?
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t" style={{ borderColor: isDark ? D.border : '#F1F5F9' }}>
                      <button
                        onClick={() => setShowSignOutConfirm(false)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ color: isDark ? D.textSecondary : '#64748B' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          setShowSignOutConfirm(false);
                          await logout();
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <RoleIcon name="LogOut" size={12} />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={handleOpenSidePanel}
              className="px-3 py-1 rounded-full text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 hover:opacity-90"
              style={{ background: '#7C3AED' }}
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => handleOpenSidePanel('settings')}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0"
            style={{
              color: isDark ? D.textSecondary : '#64748B',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }}
            title="Settings"
          >
            <RoleIcon name="Settings" size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Recent Prompt Glass Card ────────────────────────── */}
      <div className="px-4 py-2">
        <div
          onClick={handleOpenSidePanel}
          className="rounded-xl p-3 transition-all duration-150 cursor-pointer group"
          style={{
            background: isDark ? D.surface : '#FFFFFF',
            border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
            boxShadow: isDark
              ? '0 2px 10px rgba(0, 0, 0, 0.25)'
              : '0 1px 4px rgba(124, 58, 237, 0.04)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#8B5CF6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isDark ? (D.border as string) : '#ECE9FF';
          }}
        >
          {recentPrompt ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[9.5px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-md"
                  style={{
                    background: isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF',
                    color: isDark ? '#C084FC' : '#7C3AED',
                    border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.25)' : 'rgba(124, 58, 237, 0.15)'}`,
                  }}
                >
                  Recent Prompt
                </span>
                <span className="text-[10px]" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>
                  {formatTime(recentPrompt.createdAt)}
                </span>
              </div>
              <p
                className="text-[12px] font-medium line-clamp-2 leading-snug transition-colors"
                style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
              >
                {recentPrompt.title || recentPrompt.originalText}
              </p>
            </div>
          ) : (
            <div className="text-center py-2 flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center mb-1.5"
                style={{
                  background: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
                  color: isDark ? '#C084FC' : '#7C3AED',
                }}
              >
                <Sparkles size={16} />
              </div>
              <h3 className="text-[11.5px] font-semibold mb-0.5" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                No prompts enhanced yet
              </h3>
              <p className="text-[10.5px] leading-relaxed max-w-[220px]" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                Navigate to ChatGPT, Claude, or Gemini to start enhancing your prompts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions Grid ──────────────────────────────── */}
      <div className="px-4 py-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { icon: 'Clock', label: 'History', action: () => handleOpenSidePanel('history') },
            { icon: 'BarChart3', label: 'Analytics', action: () => handleOpenSidePanel('analytics') },
            { icon: 'Download', label: 'Context', action: () => handleOpenSidePanel('context') },
            { icon: 'Settings', label: 'Settings', action: () => handleOpenSidePanel('settings') },
          ].map((item) => (
            <motion.button
              key={item.label}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={item.action}
              className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer group"
              style={{
                background: isDark ? D.surface : '#FFFFFF',
                border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
                boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 3px rgba(124, 58, 237, 0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8B5CF6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isDark ? (D.border as string) : '#ECE9FF';
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: isDark ? D.surface2 : '#F8FAFC',
                  color: isDark ? '#C084FC' : '#7C3AED',
                }}
              >
                <RoleIcon name={item.icon} size={14} strokeWidth={1.8} />
              </div>
              <span
                className="text-[10px] font-medium transition-colors"
                style={{ color: isDark ? D.textSecondary : '#475569' }}
              >
                {item.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        className="px-5 py-3 border-t flex items-center justify-between"
        style={{
          background: isDark ? 'rgba(14, 13, 20, 0.7)' : 'rgba(248, 250, 252, 0.8)',
          borderColor: isDark ? D.border : 'rgba(236, 233, 255, 0.8)',
        }}
      >
        <button
          onClick={() => window.open('https://aure.ai/pro', '_blank')}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-85 cursor-pointer"
        >
          <RoleIcon name="Crown" size={14} className="text-amber-400" strokeWidth={2} />
          <span className="text-xs font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
            Upgrade to Pro
          </span>
          <RoleIcon name="ArrowUpRight" size={12} className="text-purple-400" />
        </button>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
            color: isDark ? D.textMuted : '#64748B',
          }}
        >
          v1.0.0
        </span>
      </div>
    </div>
  );
};

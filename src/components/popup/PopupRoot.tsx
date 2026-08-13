// ──────────────────────────────────────────────────────────────
// PopupRoot — Premium single-screen launcher
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { sendMessage } from '@/lib/messaging';
import type { Prompt } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';

export const PopupRoot: React.FC = () => {
  const { user, isAuthenticated, loadAuth, logout } = useAuthStore();
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

  const handleOpenSidePanel = async () => {
    try {
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
    <div className="flex flex-col w-[340px]" style={{ background: '#FAFAFE' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            className="w-8 h-8 object-contain"
            alt="AURE"
          />
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: '#1a1a2e', letterSpacing: '-0.02em' }}>
              AURE
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenSidePanel}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-200/60 hover:bg-primary-100/70 transition-all text-xs font-semibold shadow-2xs"
                  title={user.email}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="max-w-[85px] truncate text-[11px] font-bold">
                    {user.display_name || user.email.split('@')[0]}
                  </span>
                </button>

                <button
                  onClick={() => setShowSignOutConfirm(!showSignOutConfirm)}
                  className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 border border-rose-200/70 hover:bg-rose-100 transition-all flex items-center justify-center shadow-2xs shrink-0"
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
                    className="absolute right-0 top-full mt-2 w-60 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 text-left"
                    style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.12)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-500 shrink-0">
                        <RoleIcon name="LogOut" size={15} strokeWidth={2} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Sign Out of AURE?</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Are you sure you want to sign out of <strong className="text-slate-700">{user.email}</strong>?
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setShowSignOutConfirm(false)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          setShowSignOutConfirm(false);
                          await logout();
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-sm flex items-center gap-1"
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
              className="px-2.5 py-1 rounded-full bg-primary-500 hover:bg-primary-600 text-white text-[11px] font-bold shadow-sm transition-all"
            >
              Sign In
            </button>
          )}

          <button
            onClick={handleOpenSidePanel}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{ color: '#8E8EA0', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
            title="Settings"
          >
            <RoleIcon name="Settings" size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Recent Prompt Card ──────────────────────────────── */}
      <div className="px-5 pb-4">
        <div
          className="rounded-xl px-4 py-3.5 transition-all duration-200 cursor-pointer group"
          style={{
            background: '#FFFFFF',
            border: '1px solid #ECE9FF',
          }}
          onClick={handleOpenSidePanel}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#A78BFA'; e.currentTarget.style.background = '#F5F3FF'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#ECE9FF'; e.currentTarget.style.background = '#FFFFFF'; }}
        >
          {recentPrompt ? (
            <>
              <p
                className="text-[13px] font-medium truncate"
                style={{ color: '#1a1a2e' }}
              >
                {recentPrompt.title || recentPrompt.originalText.slice(0, 50)}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px]" style={{ color: '#8E8EA0' }}>
                  {formatTime(recentPrompt.createdAt)}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px]" style={{ color: '#8E8EA0' }}>
                No prompts enhanced yet
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#c4c4d4' }}>
                Navigate to ChatGPT, Claude, or Gemini to start
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Quick Actions Row ──────────────────────────────── */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-around">
          {[
            { icon: 'Clock', label: 'History', action: handleOpenSidePanel },
            { icon: 'Layers', label: 'Versions', action: handleOpenSidePanel },
            { icon: 'BarChart3', label: 'Analytics', action: handleOpenSidePanel },
            { icon: 'Globe', label: 'Website', action: () => window.open('https://aure.ai', '_blank') },
            { icon: 'Settings', label: 'Workspace', action: handleOpenSidePanel },
          ].map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.02 }}
              onClick={item.action}
              className="flex flex-col items-center gap-1 transition-all duration-200 group"
              style={{
                padding: '8px 6px',
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#8E8EA0',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
            >
              <RoleIcon name={item.icon} size={18} strokeWidth={1.75} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid #ECE9FF' }}
      >
        <motion.button
          whileHover={{ x: 2 }}
          onClick={() => window.open('https://aure.ai/pro', '_blank')}
          className="flex items-center gap-1.5 transition-colors duration-200"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#7C5CFC',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <RoleIcon name="Crown" size={14} strokeWidth={2} />
          Upgrade to Pro
          <RoleIcon name="ArrowUpRight" size={12} />
        </motion.button>
        <span style={{ fontSize: 10, color: '#c4c4d4' }}>v1.0.0</span>
      </div>
    </div>
  );
};

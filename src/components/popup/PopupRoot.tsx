// ──────────────────────────────────────────────────────────────
// PopupRoot — Apple macOS / iOS Inspired Extension Launcher
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { sendMessage } from '@/lib/messaging';
import type { Prompt } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';
import { Sparkles } from 'lucide-react';

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
    <div className="w-[340px] bg-[#FAFAFE] select-none font-sans text-slate-900 overflow-hidden flex flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            className="w-8 h-8 object-contain drop-shadow-xs"
            alt="AURE Logo"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                AURE
              </h1>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-100/70 text-purple-600 text-[10px] font-bold flex items-center gap-0.5">
                <Sparkles size={9} /> Pro
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenSidePanel}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200/80 hover:bg-slate-50 transition-all text-xs font-semibold shadow-2xs"
                  title={user.email}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="max-w-[80px] truncate text-[11px] font-bold text-slate-800">
                    {user.display_name || user.email.split('@')[0]}
                  </span>
                </button>

                <button
                  onClick={() => setShowSignOutConfirm(!showSignOutConfirm)}
                  className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 border border-rose-200/70 hover:bg-rose-100 transition-all flex items-center justify-center shadow-2xs shrink-0 cursor-pointer"
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
              className="px-3.5 py-1.5 rounded-full bg-[#111827] hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Sign In
            </button>
          )}

          <button
            onClick={handleOpenSidePanel}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
            title="Open Workspace"
          >
            <RoleIcon name="Settings" size={17} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Recent Prompt Glass Card ────────────────────────── */}
      <div className="px-5 py-2">
        <div
          onClick={handleOpenSidePanel}
          className="rounded-2xl p-4 bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-purple-200 transition-all duration-200 cursor-pointer group"
        >
          {recentPrompt ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-purple-600 uppercase bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  Recent Prompt
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {formatTime(recentPrompt.createdAt)}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-relaxed group-hover:text-purple-600 transition-colors">
                {recentPrompt.title || recentPrompt.originalText}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-2">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                <Sparkles size={20} />
              </div>
              <h3 className="text-xs font-bold text-slate-900 mb-1">
                No prompts enhanced yet
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[240px]">
                Navigate to ChatGPT, Claude, or Gemini to start enhancing your prompts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions Grid ──────────────────────────────── */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: 'Clock', label: 'History', action: handleOpenSidePanel },
            { icon: 'Layers', label: 'Versions', action: handleOpenSidePanel },
            { icon: 'BarChart3', label: 'Analytics', action: handleOpenSidePanel },
            { icon: 'Layout', label: 'Workspace', action: handleOpenSidePanel },
          ].map((item) => (
            <motion.button
              key={item.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={item.action}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white border border-slate-200/70 hover:bg-purple-50/50 hover:border-purple-200 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 group-hover:bg-purple-100/70 group-hover:text-purple-600 flex items-center justify-center transition-colors">
                <RoleIcon name={item.icon} size={17} strokeWidth={1.8} />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-purple-700 transition-colors">
                {item.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Apple Footer ───────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-slate-200/60 flex items-center justify-between bg-slate-50/50">
        <button
          onClick={() => window.open('https://aure.ai/pro', '_blank')}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-85 cursor-pointer"
        >
          <RoleIcon name="Crown" size={14} className="text-amber-500" strokeWidth={2} />
          <span className="text-xs font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
            Upgrade to Pro
          </span>
          <RoleIcon name="ArrowUpRight" size={12} className="text-purple-600" />
        </button>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full font-medium">
          v1.0.0
        </span>
      </div>
    </div>
  );
};

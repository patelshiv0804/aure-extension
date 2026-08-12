// ──────────────────────────────────────────────────────────────
// SidePanelRoot — Workspace with segmented tab control
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { FullHistory } from './FullHistory';
import { Analytics } from './Analytics';
import { RoleIcon } from '../common/RoleIcon';

type SidePanelTab = 'history' | 'analytics';

export const SidePanelRoot: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('history');
  const { loadSettings } = useSettingsStore();
  const { user, isAuthenticated, loadAuth, logout } = useAuthStore();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAuth();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (
        areaName === 'local' &&
        (changes['userProfile'] || changes['promptiq_token'] || changes['apiToken'] || changes['currentUserEmail'])
      ) {
        loadAuth();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, [loadSettings, loadAuth]);

  const tabs: Array<{ id: SidePanelTab; label: string; icon: string }> = [
    { id: 'history', label: 'History', icon: 'Clock' },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#FAFAFE' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(250, 250, 254, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid #ECE9FF',
        }}
      >
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
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
              <p className="text-[11px]" style={{ color: '#8E8EA0' }}>Workspace</p>
            </div>
          </div>

          <div>
            {isAuthenticated && user ? (
              <div className="relative">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => chrome.runtime.openOptionsPage()}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-200/60 hover:bg-primary-100/70 transition-all text-xs font-semibold shadow-2xs"
                    title={user.email}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="max-w-[95px] truncate text-[11px] font-bold">
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
                      className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 text-left"
                      style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.12)' }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-xl bg-rose-50 text-rose-500 shrink-0">
                          <RoleIcon name="LogOut" size={16} strokeWidth={2} />
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
                onClick={() => chrome.runtime.openOptionsPage()}
                className="px-3 py-1 rounded-full bg-primary-500 hover:bg-primary-600 text-white text-[11px] font-bold shadow-sm transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Segmented Control */}
        <div className="px-5 pb-3">
          <div
            className="flex rounded-xl p-1"
            style={{
              background: '#F0EDF9',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200"
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? '#1a1a2e' : '#8E8EA0',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="segmentedTab"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: '#FFFFFF',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      zIndex: -1,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <RoleIcon name={tab.icon} size={14} strokeWidth={activeTab === tab.id ? 2 : 1.75} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'history' && <FullHistory />}
            {activeTab === 'analytics' && <Analytics />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

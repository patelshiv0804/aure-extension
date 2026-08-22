import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { isKnownSite } from '@/adapters/registry';
import { FullHistory } from './FullHistory';
import { Analytics } from './Analytics';
import { AuthView } from '../auth/AuthView';
import { RoleIcon } from '../common/RoleIcon';

type SidePanelTab = 'history' | 'analytics';

export const SidePanelRoot: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('history');
  const [showAuthView, setShowAuthView] = useState(false);
  const { loadSettings } = useSettingsStore();
  const { user, isAuthenticated, loadAuth, logout } = useAuthStore();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const [isSupportedSite, setIsSupportedSite] = useState<boolean>(true);
  const [currentTabHost, setCurrentTabHost] = useState<string>('');

  const checkActiveTab = useCallback(async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [lastFocusedTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        let activeTabObj: chrome.tabs.Tab | undefined = lastFocusedTab;

        if (!activeTabObj || !activeTabObj.url) {
          const [currentWinTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          activeTabObj = currentWinTab;
        }

        if (!activeTabObj || !activeTabObj.url) {
          const allTabs = await chrome.tabs.query({ active: true });
          activeTabObj = allTabs.find((t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
        }

        if (activeTabObj?.url) {
          const url = activeTabObj.url;
          if (url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
            setIsSupportedSite(false);
            setCurrentTabHost('Extension Page');
            return;
          }
          try {
            const host = new URL(url).hostname;
            const supported = isKnownSite(host);
            setIsSupportedSite(supported);
            setCurrentTabHost(host);
          } catch {
            setIsSupportedSite(false);
            setCurrentTabHost('');
          }
        } else {
          setIsSupportedSite(false);
          setCurrentTabHost('');
        }
      } catch (e) {
        console.warn('[AURE Sidepanel] Failed to check active tab:', e);
        setIsSupportedSite(false);
      }
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadAuth();
    checkActiveTab();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (
        areaName === 'local' &&
        (changes['userProfile'] || changes['currentUserEmail'])
      ) {
        loadAuth();
      }
    };

    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener(handleStorageChange);
      }

      if (chrome.tabs) {
        const handleActivated = () => {
          checkActiveTab();
        };
        const handleUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (changeInfo.status === 'complete' || changeInfo.url) {
            checkActiveTab();
          }
        };

        chrome.tabs.onActivated.addListener(handleActivated);
        chrome.tabs.onUpdated.addListener(handleUpdated);

        if (chrome.windows?.onFocusChanged) {
          chrome.windows.onFocusChanged.addListener(handleActivated);
        }

        return () => {
          if (chrome.storage?.onChanged) {
            chrome.storage.onChanged.removeListener(handleStorageChange);
          }
          chrome.tabs.onActivated.removeListener(handleActivated);
          chrome.tabs.onUpdated.removeListener(handleUpdated);
          if (chrome.windows?.onFocusChanged) {
            chrome.windows.onFocusChanged.removeListener(handleActivated);
          }
        };
      }
    }
  }, [loadSettings, loadAuth, checkActiveTab]);

  // Reset showAuthView once user successfully logs in
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuthView(false);
    }
  }, [isAuthenticated]);

  const tabs: Array<{ id: SidePanelTab; label: string; icon: string }> = [
    { id: 'history', label: 'History', icon: 'Clock' },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
  ];

  // Return dedicated non-scrollable centered view for unsupported sites
  if (!isSupportedSite) {
    return (
      <div className="h-screen w-full max-h-screen overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none relative bg-[#FAFAFE]">
        {/* Soft Ambient Blur Orbs */}
        <div className="absolute top-1/4 -left-12 w-64 h-64 rounded-full bg-purple-200/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-12 w-64 h-64 rounded-full bg-indigo-200/50 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-purple-100/40 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-[310px] bg-white/90 backdrop-blur-2xl p-6 rounded-3xl border border-purple-100/80 shadow-[0_16px_40px_rgba(124,92,252,0.08)] flex flex-col items-center text-center space-y-4"
        >
          {/* Brand Icon Header */}
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-purple-100 flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="AURE" className="w-7 h-7 object-contain" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-2xs">
              !
            </span>
          </div>

          {/* Title & Domain Tag */}
          <div className="space-y-2 w-full">
            <h3 className="text-[16px] font-bold text-slate-900 tracking-tight">
              This Site is Not Supported
            </h3>

            {currentTabHost && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[11px] font-mono text-slate-600 max-w-[240px] truncate shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {currentTabHost}
                </span>
              </div>
            )}

            <p className="text-[12px] text-slate-500 leading-relaxed px-1">
              AURE Workspace is active on supported AI platforms. Open a chat site below to view prompt history & features.
            </p>
          </div>

          {/* Supported AI Platforms Grid */}
          <div className="w-full pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Supported AI Platforms
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'ChatGPT', url: 'https://chatgpt.com', color: '#10A37F' },
                { name: 'Claude', url: 'https://claude.ai', color: '#D97706' },
                { name: 'Gemini', url: 'https://gemini.google.com', color: '#1A73E8' },
                { name: 'Perplexity', url: 'https://perplexity.ai', color: '#20B2AA' },
                { name: 'Grok', url: 'https://grok.com', color: '#0F172A' },
                { name: 'DeepSeek', url: 'https://chat.deepseek.com', color: '#4F46E5' },
              ].map((site) => (
                <a
                  key={site.name}
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-purple-300 hover:bg-purple-50/60 hover:shadow-xs transition-all text-left text-decoration-none group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: site.color }}
                    />
                    <span className="text-[11.5px] font-semibold text-slate-800 group-hover:text-purple-700 transition-colors truncate">
                      {site.name}
                    </span>
                  </div>
                  <RoleIcon name="ExternalLink" size={11} className="text-slate-400 group-hover:text-purple-600 shrink-0 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#FAFAFE' }}>
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
                    onClick={() => setShowAuthView(!showAuthView)}
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
                onClick={() => setShowAuthView(!showAuthView)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold shadow-sm transition-all ${
                  showAuthView
                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                }`}
              >
                {showAuthView ? 'Back' : 'Sign In'}
              </button>
            )}
          </div>
        </div>

        {/* Segmented Control (only when not showing AuthView) */}
        {!showAuthView && (
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
        )}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {showAuthView && !isAuthenticated ? (
            <motion.div
              key="auth-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <AuthView />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'history' && <FullHistory onSignIn={() => setShowAuthView(true)} />}
              {activeTab === 'analytics' && <Analytics />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

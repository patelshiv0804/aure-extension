import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/hooks/useTheme';
import { isKnownSite } from '@/adapters/registry';
import { FullHistory } from './FullHistory';
import { Analytics } from './Analytics';
import { AuthView } from '../auth/AuthView';
import { RoleIcon } from '../common/RoleIcon';
import { ThemeToggle } from '../common/ThemeToggle';
import { AppearanceSettings } from '../settings/AppearanceSettings';
import { ExportContextView } from './ExportContextView';

type SidePanelTab = 'history' | 'context' | 'analytics' | 'settings';

export const SidePanelRoot: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('history');
  const [contextExportInitialIds, setContextExportInitialIds] = useState<string[] | undefined>(undefined);
  const [showAuthView, setShowAuthView] = useState(false);
  const { loadSettings } = useSettingsStore();
  const { user, isAuthenticated, loadAuth, logout } = useAuthStore();
  const { isDark, D, L } = useTheme();
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

    const checkTargetTab = () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get('targetSidePanelTab', (res) => {
          const target = res?.targetSidePanelTab as SidePanelTab | undefined;
          if (target && ['history', 'analytics', 'context', 'settings'].includes(target)) {
            setActiveTab(target);
            setShowAuthView(false);
            chrome.storage.local.remove('targetSidePanelTab');
          }
        });
      }
    };
    checkTargetTab();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local') {
        if (changes['targetSidePanelTab']?.newValue) {
          const target = changes['targetSidePanelTab'].newValue as SidePanelTab;
          if (['history', 'analytics', 'context', 'settings'].includes(target)) {
            setActiveTab(target);
            setShowAuthView(false);
            chrome.storage.local.remove('targetSidePanelTab');
          }
        }
        if (changes['userProfile'] || changes['currentUserEmail']) {
          loadAuth();
        }
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
    { id: 'context', label: 'Context', icon: 'Download' },
    { id: 'settings', label: 'Settings', icon: 'Settings' },
  ];

  // Return dedicated non-scrollable centered view for unsupported sites
  if (!isSupportedSite) {
    return (
      <div
        className="h-screen w-full max-h-screen overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none relative"
        style={{ background: isDark ? D.bg : L.bg }}
      >
        {/* Soft Ambient Blur Orbs */}
        <div
          className="absolute top-1/4 -left-12 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(233, 213, 255, 0.5)' }}
        />
        <div
          className="absolute bottom-1/4 -right-12 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(199, 210, 254, 0.5)' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-[310px] backdrop-blur-2xl p-6 rounded-3xl flex flex-col items-center text-center space-y-4"
          style={{
            background: isDark ? 'rgba(20, 19, 32, 0.90)' : 'rgba(255, 255, 255, 0.92)',
            border: `1px solid ${isDark ? D.border : 'rgba(236, 233, 255, 0.8)'}`,
            boxShadow: isDark
              ? '0 20px 48px rgba(0, 0, 0, 0.6)'
              : '0 16px 40px rgba(124, 92, 252, 0.08)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner"
            style={{
              background: isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(245, 243, 255, 1)',
              border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.25)' : 'rgba(236, 233, 255, 1)'}`,
            }}
          >
            <img src="/logo.png" className="w-9 h-9 object-contain" alt="AURE Logo" />
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold tracking-tight" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
              Supported on AI Platforms
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: isDark ? D.textSecondary : '#8E8EA0' }}>
              AURE works automatically on ChatGPT, Claude, Gemini, DeepSeek, and Perplexity.
            </p>
          </div>

          <div className="w-full pt-2">
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
              style={{ background: '#7C3AED' }}
            >
              Open ChatGPT
              <RoleIcon name="ExternalLink" size={13} strokeWidth={2} />
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-screen max-h-screen overflow-hidden"
      style={{
        background: isDark ? D.bg : L.bg,
        color: isDark ? D.textPrimary : L.textPrimary,
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="shrink-0 z-20"
        style={{
          background: isDark ? 'rgba(14, 13, 20, 0.88)' : 'rgba(250, 250, 254, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
        }}
      >
        <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-2">
            <h1 className="text-[13.5px] font-semibold tracking-tight leading-tight" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
              {showAuthView
                ? 'Account'
                : activeTab === 'history'
                ? 'History'
                : activeTab === 'analytics'
                ? 'Analytics'
                : activeTab === 'context'
                ? 'Context'
                : 'Settings'}
            </h1>
            <p className="text-[10px] leading-normal truncate mt-0.5" style={{ color: isDark ? D.textMuted : '#64748B' }}>
              {showAuthView
                ? 'Manage your account and synchronization.'
                : activeTab === 'history'
                ? 'Search, review, and restore your enhanced prompts.'
                : activeTab === 'analytics'
                ? 'Track prompt quality scores and AI model usage.'
                : activeTab === 'context'
                ? 'Export prompts and clean context for AI models.'
                : 'Customize appearance and workspace preferences.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick 3-Way Theme Toggle */}
            <ThemeToggle align="right" />

            {isAuthenticated && user ? (
              <div className="relative">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowAuthView(!showAuthView)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all text-xs font-semibold shadow-2xs cursor-pointer"
                    style={{
                      background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
                      border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.2)'}`,
                      color: isDark ? '#C084FC' : '#7C3AED',
                    }}
                    title={user.email}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="max-w-[85px] truncate text-[11px] font-bold">
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

                {/* Sign Out Confirmation Popover */}
                <AnimatePresence>
                  {showSignOutConfirm && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 4 }}
                      className="absolute right-0 top-full mt-2 w-64 p-3.5 rounded-2xl shadow-xl z-50 text-left"
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
                          <RoleIcon name="LogOut" size={16} strokeWidth={2} />
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
                          style={{
                            color: isDark ? D.textSecondary : '#64748B',
                          }}
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
                onClick={() => setShowAuthView(!showAuthView)}
                className="px-3 py-1 rounded-full text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                style={{
                  background: showAuthView
                    ? isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'
                    : '#7C3AED',
                  color: showAuthView
                    ? isDark ? D.textPrimary : '#334155'
                    : '#FFFFFF',
                }}
              >
                {showAuthView ? 'Back' : 'Sign In'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
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
              {activeTab === 'history' && (
                <FullHistory
                  onSignIn={() => setShowAuthView(true)}
                />
              )}
              {activeTab === 'context' && (
                <ExportContextView
                  initialSelectedIds={contextExportInitialIds}
                  onSignIn={() => setShowAuthView(true)}
                />
              )}
              {activeTab === 'analytics' && <Analytics onNavigateHistory={() => setActiveTab('history')} />}
              {activeTab === 'settings' && (
                <div className="p-3.5 space-y-3.5">
                  {/* Appearance section inside Sidepanel */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: isDark ? D.surface : '#FFFFFF',
                      border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
                      boxShadow: isDark
                        ? '0 4px 20px rgba(0, 0, 0, 0.35)'
                        : '0 4px 16px rgba(124, 58, 237, 0.04)',
                    }}
                  >
                    <AppearanceSettings compact={true} />
                  </div>

                  {/* Account Summary Card */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: isDark ? D.surface : '#FFFFFF',
                      border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
                      boxShadow: isDark
                        ? '0 4px 20px rgba(0, 0, 0, 0.35)'
                        : '0 4px 16px rgba(124, 58, 237, 0.04)',
                    }}
                  >
                    <h3
                      className="text-[13px] font-semibold mb-1"
                      style={{ color: isDark ? D.textPrimary : '#0F172A' }}
                    >
                      Account & Sync
                    </h3>
                    <p
                      className="text-[11.5px] mb-3 leading-relaxed"
                      style={{ color: isDark ? D.textSecondary : '#64748B' }}
                    >
                      {isAuthenticated && user
                        ? `Signed in as ${user.email} (${user.plan || 'Pro'} tier)`
                        : 'Sign in to automatically sync your prompt history across AI platforms.'}
                    </p>

                    {isAuthenticated && user ? (
                      <div
                        className="flex items-center justify-between p-2.5 rounded-lg"
                        style={{
                          background: isDark ? D.surface2 : '#F8FAFC',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11.5px] font-medium" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                            {user.display_name || user.email}
                          </span>
                        </div>
                        <span
                          className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            background: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE',
                            color: isDark ? '#C084FC' : '#7C3AED',
                          }}
                        >
                          {user.plan || 'Pro'}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAuthView(true)}
                        className="w-full py-2 px-3 rounded-lg text-[11.5px] font-semibold text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 hover:opacity-90"
                        style={{ background: '#7C3AED' }}
                      >
                        Sign In to Sync History
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile-Style Bottom Navigation Bar ──────────────── */}
      <nav
        aria-label="Mobile Navigation"
        className="shrink-0 z-30 w-full select-none"
        style={{
          background: isDark ? 'rgba(14, 13, 20, 0.94)' : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#ECE9FF'}`,
          boxShadow: isDark
            ? '0 -6px 24px rgba(0, 0, 0, 0.5)'
            : '0 -4px 20px rgba(124, 58, 237, 0.06)',
        }}
      >
        <div className="grid grid-cols-4 items-center px-2 py-1.5 gap-1">
          {tabs.map((tab) => {
            const isActive = !showAuthView && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowAuthView(false);
                }}
                className="relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer group"
                style={{
                  color: isActive
                    ? isDark ? '#C084FC' : '#7C3AED'
                    : isDark ? '#94A3B8' : '#64748B',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileNavPill"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(139, 92, 246, 0.12) 100%)'
                        : 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(147, 51, 234, 0.08) 100%)',
                      border: `1px solid ${isDark ? 'rgba(192, 132, 252, 0.28)' : 'rgba(124, 58, 237, 0.2)'}`,
                    }}
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                <div
                  className="relative z-10 transition-transform duration-150"
                  style={{ transform: isActive ? 'scale(1.05)' : 'scale(1)' }}
                >
                  <RoleIcon
                    name={tab.icon}
                    size={16}
                    strokeWidth={isActive ? 2.1 : 1.7}
                  />
                </div>

                <span
                  className="relative z-10 text-[10px] mt-0.5 tracking-normal transition-all"
                  style={{
                    fontWeight: isActive ? 600 : 450,
                    color: isActive
                      ? isDark ? '#F1F5F9' : '#0F172A'
                      : isDark ? '#94A3B8' : '#64748B',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};


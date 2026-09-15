// ──────────────────────────────────────────────────────────────
// SettingsRoot — Extension Settings / Options page
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/hooks/useTheme';
import { RoleIcon } from '../common/RoleIcon';
import { ThemeToggle } from '../common/ThemeToggle';
import { AppearanceSettings } from './AppearanceSettings';

type SettingsSection = 'appearance' | 'account';

export const SettingsRoot: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { loadAuth } = useAuthStore();
  const { isDark, D, L } = useTheme();

  useEffect(() => {
    loadAuth();

    // Reset html/body styling inside options page to prevent popup dimensions from leaking
    const resetStyles = () => {
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
      document.documentElement.style.minHeight = '100vh';
      document.documentElement.style.maxHeight = 'none';
      document.documentElement.style.overflow = 'auto';

      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.minHeight = '100vh';
      document.body.style.maxHeight = 'none';
      document.body.style.overflow = 'auto';
    };

    resetStyles();
    const timer = setTimeout(resetStyles, 100);
    return () => clearTimeout(timer);
  }, [loadAuth]);

  const sections: Array<{ id: SettingsSection; label: string; icon: string }> = [
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'account', label: 'Account', icon: '👤' },
  ];

  return (
    <div
      className="min-h-screen flex w-full transition-colors duration-200"
      style={{
        background: isDark ? D.bg : L.bg,
        color: isDark ? D.textPrimary : L.textPrimary,
      }}
    >
      {/* Sidebar */}
      <div
        className="w-64 p-6 sticky top-0 h-screen flex-shrink-0 border-r flex flex-col justify-between"
        style={{
          background: isDark ? 'rgba(14, 13, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: isDark ? D.border : '#ECE9FF',
        }}
      >
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" className="w-9 h-9 rounded-xl object-contain" alt="AURE Logo" />
              <div>
                <h1 className="text-sm font-bold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                  Settings
                </h1>
                <p className="text-[10px]" style={{ color: isDark ? D.textMuted : '#64748B' }}>
                  AURE
                </p>
              </div>
            </div>
            <ThemeToggle align="left" />
          </div>

          <nav className="space-y-1">
            {sections.map((section) => {
              const isSelected = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
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
                      ? D.textSecondary
                      : '#64748B',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#F8FAFC';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span className="text-sm">{section.icon}</span>
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t" style={{ borderColor: isDark ? D.border : '#ECE9FF' }}>
          <p className="text-[11px]" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>
            AURE Extension v1.0.0
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-10 max-w-3xl overflow-y-auto h-screen">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-8 pb-20"
        >
          {/* ── Appearance Section ────────────── */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                  Interface Theme
                </h2>
                <p className="text-xs leading-relaxed" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                  Customize the look and feel of the AURE workspace, popup, and in-page overlays.
                </p>
              </div>

              <div
                className="p-6 rounded-3xl"
                style={{
                  background: isDark ? D.surface : '#FFFFFF',
                  border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
                  boxShadow: isDark
                    ? '0 4px 24px rgba(0, 0, 0, 0.35)'
                    : '0 4px 20px rgba(124, 58, 237, 0.04)',
                }}
              >
                <AppearanceSettings />
              </div>
            </div>
          )}

          {/* ── Account Section ───────────────── */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                  Account & Authentication
                </h2>
                <p className="text-xs leading-relaxed" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                  Manage your signed-in profile and HTTP cookie session.
                </p>
              </div>

              {useAuthStore.getState().isAuthenticated && useAuthStore.getState().user ? (
                <div
                  className="p-6 rounded-3xl space-y-6"
                  style={{
                    background: isDark ? D.surface : '#FFFFFF',
                    border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
                    boxShadow: isDark
                      ? '0 4px 24px rgba(0, 0, 0, 0.35)'
                      : '0 4px 20px rgba(124, 58, 237, 0.04)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary-500/20">
                      {useAuthStore.getState().user?.avatar_url ? (
                        <img
                          src={useAuthStore.getState().user?.avatar_url || undefined}
                          alt="User Avatar"
                          className="w-full h-full rounded-2xl object-cover"
                        />
                      ) : (
                        (useAuthStore.getState().user?.display_name || useAuthStore.getState().user?.email || '')
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                          {useAuthStore.getState().user?.display_name || 'AURE User'}
                        </h3>
                        <span
                          className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full"
                          style={{
                            background: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE',
                            color: isDark ? '#C084FC' : '#7C3AED',
                            border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.2)'}`,
                          }}
                        >
                          {useAuthStore.getState().user?.plan || 'Pro'}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                        {useAuthStore.getState().user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t" style={{ borderColor: isDark ? D.border : '#F1F5F9' }}>
                    <div
                      className="flex justify-between items-center text-xs py-2.5 px-3.5 rounded-xl"
                      style={{
                        background: isDark ? D.surface2 : '#F8FAFC',
                      }}
                    >
                      <span className="font-medium" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                        Session Status
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        HTTP Cookie Session Active
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="p-8 rounded-3xl text-center space-y-4"
                  style={{
                    background: isDark ? D.surface : '#FFFFFF',
                    border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
                    boxShadow: isDark
                      ? '0 4px 24px rgba(0, 0, 0, 0.35)'
                      : '0 4px 20px rgba(124, 58, 237, 0.04)',
                  }}
                >
                  <div
                    className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-xl"
                    style={{
                      background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
                      color: isDark ? '#C084FC' : '#7C3AED',
                    }}
                  >
                    🔐
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                      Sign In via Workspace Sidepanel
                    </h3>
                    <p className="text-xs mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                      Authentication and account management are handled directly inside the AURE Workspace sidepanel.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (tab?.windowId) {
                          await chrome.sidePanel.open({ windowId: tab.windowId });
                        }
                      } catch (e) {
                        console.error('[AURE] Failed to open sidepanel:', e);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' }}
                  >
                    <RoleIcon name="Layout" size={14} />
                    Open Workspace Sidepanel
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

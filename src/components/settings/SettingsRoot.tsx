// ──────────────────────────────────────────────────────────────
// SettingsRoot — Extension Settings / Options page
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { RoleIcon } from '../common/RoleIcon';

type SettingsSection = 'account';

export const SettingsRoot: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const { loadAuth } = useAuthStore();

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
    // Re-apply on slight delay to overwrite WXT injects
    const timer = setTimeout(resetStyles, 100);
    return () => clearTimeout(timer);
  }, [loadAuth]);

  const sections: Array<{ id: SettingsSection; label: string; icon: string }> = [
    { id: 'account', label: 'Account', icon: '👤' },
  ];

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar */}
      <div className="w-60 border-r border-slate-200/60 p-5 sticky top-0 h-screen flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.png" className="w-9 h-9 rounded-xl object-contain" alt="AURE Logo" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">Settings</h1>
            <p className="text-[10px] text-slate-500">AURE</p>
          </div>
        </div>

        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${activeSection === section.id
                  ? 'bg-primary-500/10 text-primary-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                }
              `}
            >
              <span className="text-sm">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 max-w-2xl overflow-y-auto h-screen">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-6 pb-20"
        >
          {/* ── Account ──────────────────────── */}
          {activeSection === 'account' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Account & Authentication</h2>
                <p className="text-xs text-slate-500">Manage your signed-in profile and HTTP cookie session</p>
              </div>

              {useAuthStore.getState().isAuthenticated && useAuthStore.getState().user ? (
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-6">
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
                        <h3 className="text-base font-bold text-slate-900">
                          {useAuthStore.getState().user?.display_name || 'AURE User'}
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-primary-50 text-primary-600 border border-primary-200/60 rounded-full">
                          {useAuthStore.getState().user?.plan || 'Pro'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{useAuthStore.getState().user?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs py-2 px-3 rounded-lg bg-slate-50">
                      <span className="text-slate-500 font-medium">Session Status</span>
                      <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        HTTP Cookie Session Active
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center text-xl">
                    🔐
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Sign In via Workspace Sidepanel</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Authentication and account management are now handled directly inside the AURE Workspace sidepanel.
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
                    className="px-4 py-2 text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 rounded-xl shadow-sm transition-all inline-flex items-center gap-2"
                  >
                    <RoleIcon name="Layout" size={14} />
                    Open Workspace Sidepanel
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

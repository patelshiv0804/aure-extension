// ──────────────────────────────────────────────────────────────
// SettingsRoot — Full settings / options page
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '@/stores/settings.store';
import { ENHANCEMENT_MODES } from '@/constants/modes';
import { AI_MODELS } from '@/constants/models';
import type { EnhancementMode } from '@/types/enhancement';
import { RoleIcon } from '../common/RoleIcon';

type SettingsSection = 'general' | 'ui' | 'ai' | 'privacy' | 'advanced';

export const SettingsRoot: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const { settings, updateSettings, loadSettings, resetSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();

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
  }, [loadSettings]);

  const sections: Array<{ id: SettingsSection; label: string; icon: string }> = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'ui', label: 'Appearance', icon: '🎨' },
    { id: 'ai', label: 'AI Models', icon: '🤖' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'advanced', label: 'Advanced', icon: '🔧' },
  ];

  const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-primary-500' : 'bg-slate-100'}`}
    >
      <motion.div
        animate={{ x: enabled ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
      />
    </button>
  );

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
                  ? 'bg-primary-500/10 text-primary-400'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                }
              `}
            >
              <span className="text-sm">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <button
            onClick={resetSettings}
            className="w-full px-3 py-2 text-xs text-error-400/60 hover:text-error-400 hover:bg-error-50 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
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
          {/* ── General ──────────────────────── */}
          {activeSection === 'general' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">General</h2>
                <p className="text-xs text-slate-500">Basic enhancement preferences</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="mr-4">
                    <div className="text-sm text-slate-800">Auto Enhance</div>
                    <div className="text-xs text-slate-400 mt-0.5">Automatically enhance prompts on submit</div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.general.autoEnhance}
                    onChange={(v) => updateSettings({ general: { ...settings.general, autoEnhance: v } })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="mr-4">
                    <div className="text-sm text-slate-800">Ask Before Enhance</div>
                    <div className="text-xs text-slate-400 mt-0.5">Show confirmation before enhancement</div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.general.askBeforeEnhance}
                    onChange={(v) => updateSettings({ general: { ...settings.general, askBeforeEnhance: v } })}
                  />
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-2">Default Role</div>
                  <div className="flex flex-wrap gap-2">
                    {ENHANCEMENT_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => updateSettings({ general: { ...settings.general, defaultMode: mode.id } })}
                        className={`
                          p-2 rounded-lg text-center transition-all text-xs
                          ${settings.general.defaultMode === mode.id
                            ? 'ring-2 ring-primary-500 bg-primary-500/10'
                            : 'bg-white hover:bg-slate-50'
                          }
                        `}
                      >
                        <div className="flex justify-center text-sm mb-1.5" style={{ color: mode.color }}>
                          <RoleIcon name={mode.icon} size={16} />
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium">{mode.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── UI ───────────────────────────── */}
          {activeSection === 'ui' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Appearance</h2>
                <p className="text-xs text-slate-500">Customize the look and feel</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-3">Theme</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['dark', 'light', 'system'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => updateSettings({ ui: { ...settings.ui, theme } })}
                        className={`p-3 rounded-lg text-center transition-all text-xs
                          ${settings.ui.theme === theme
                            ? 'ring-2 ring-primary-500 bg-primary-500/10'
                            : 'bg-white hover:bg-slate-50'
                          }`}
                      >
                        <div className="text-lg mb-1">
                          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻'}
                        </div>
                        <div className="text-slate-600 capitalize">{theme}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/60">
                  <div>
                    <div className="text-sm text-slate-800">Animations</div>
                    <div className="text-xs text-slate-400 mt-0.5">Enable smooth transitions</div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.ui.animationsEnabled}
                    onChange={(v) => updateSettings({ ui: { ...settings.ui, animationsEnabled: v } })}
                  />
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-3">Floating Icon Position</div>
                  <div className="grid grid-cols-4 gap-2">
                    {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => updateSettings({ ui: { ...settings.ui, floatingIconPosition: pos } })}
                        className={`p-2 rounded-lg text-center transition-all text-[10px]
                          ${settings.ui.floatingIconPosition === pos
                            ? 'ring-2 ring-primary-500 bg-primary-500/10 text-slate-800'
                            : 'bg-white hover:bg-slate-50 text-slate-500'
                          }`}
                      >
                        {pos.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── AI ───────────────────────────── */}
          {activeSection === 'ai' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">AI Models</h2>
                <p className="text-xs text-slate-500">Model preferences and recommendations</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/60">
                  <div>
                    <div className="text-sm text-slate-800">Show Recommendations</div>
                    <div className="text-xs text-slate-400 mt-0.5">Suggest better AI models for your prompts</div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.ai.showRecommendations}
                    onChange={(v) => updateSettings({ ai: { ...settings.ai, showRecommendations: v } })}
                  />
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-1">Recommendation Sensitivity</div>
                  <div className="text-xs text-slate-400 mb-3">How aggressively to suggest different models</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.ai.recommendationSensitivity}
                    onChange={(e) => updateSettings({
                      ai: { ...settings.ai, recommendationSensitivity: parseInt(e.target.value) },
                    })}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Conservative</span>
                    <span>{settings.ai.recommendationSensitivity}%</span>
                    <span>Aggressive</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-3">Supported Models</div>
                  <div className="space-y-2">
                    {AI_MODELS.map((model) => (
                      <div key={model.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white">
                        <span className="text-sm">{model.icon}</span>
                        <div className="flex-1">
                          <div className="text-xs text-slate-800">{model.name}</div>
                          <div className="text-[10px] text-slate-400">{model.provider}</div>
                        </div>
                        <span className="text-[10px] text-slate-400/60">{model.strengths.slice(0, 2).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Privacy ──────────────────────── */}
          {activeSection === 'privacy' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Privacy</h2>
                <p className="text-xs text-slate-500">Data storage and sync preferences</p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'localOnly' as const, label: 'Local Only Mode', desc: 'Keep all data on this device only' },
                  { key: 'cloudSync' as const, label: 'Cloud Sync', desc: 'Sync settings and history across devices' },
                  { key: 'saveHistory' as const, label: 'Save History', desc: 'Store prompt enhancement history' },
                  { key: 'encryptData' as const, label: 'Encrypt Data', desc: 'Encrypt stored data with a passphrase' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/60">
                    <div>
                      <div className="text-sm text-slate-800">{item.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <ToggleSwitch
                      enabled={settings.privacy[item.key]}
                      onChange={(v) => updateSettings({ privacy: { ...settings.privacy, [item.key]: v } })}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Advanced ─────────────────────── */}
          {activeSection === 'advanced' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Advanced</h2>
                <p className="text-xs text-slate-500">API configuration and custom selectors</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-2">API Endpoint</div>
                  <input
                    type="text"
                    value={settings.advanced.apiEndpoint}
                    onChange={(e) => updateSettings({
                      advanced: { ...settings.advanced, apiEndpoint: e.target.value },
                    })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-primary-500/40 font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-2">API Key</div>
                  <input
                    type="password"
                    value={settings.advanced.apiKey}
                    onChange={(e) => updateSettings({
                      advanced: { ...settings.advanced, apiKey: e.target.value },
                    })}
                    placeholder="Enter your API key"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-primary-500/40 font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/60">
                  <div className="text-sm text-slate-800 mb-2">Backend User Email</div>
                  <input
                    type="email"
                    value={settings.advanced.currentUserEmail}
                    onChange={(e) => updateSettings({
                      advanced: { ...settings.advanced, currentUserEmail: e.target.value },
                    })}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-primary-500/40 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/60">
                  <div>
                    <div className="text-sm text-slate-800">Debug Mode</div>
                    <div className="text-xs text-slate-400 mt-0.5">Show verbose logs in console</div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.advanced.debugMode}
                    onChange={(v) => updateSettings({ advanced: { ...settings.advanced, debugMode: v } })}
                  />
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

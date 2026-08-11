// ──────────────────────────────────────────────────────────────
// PopupRoot — Premium single-screen launcher
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settings.store';
import { ENHANCEMENT_MODES } from '@/constants/modes';
import { sendMessage } from '@/lib/messaging';
import { KEYBOARD_SHORTCUTS } from '@/constants/shortcuts';
import type { EnhancementMode } from '@/types/enhancement';
import type { Prompt } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';

export const PopupRoot: React.FC = () => {
  const { settings, updateSettings, loadSettings } = useSettingsStore();
  const [recentPrompt, setRecentPrompt] = useState<Prompt | null>(null);
  const [selectedRole, setSelectedRole] = useState<EnhancementMode>(
    (settings?.general?.defaultMode as EnhancementMode) || 'creator'
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Fetch most recent prompt
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const result = await sendMessage('GET_HISTORY', { limit: 1 });
        if (result.prompts?.length) setRecentPrompt(result.prompts[0]);
      } catch { /* silent */ }
    };
    fetchRecent();
  }, []);

  // Sync selected role with settings
  useEffect(() => {
    if (settings?.general?.defaultMode) {
      setSelectedRole(settings.general.defaultMode as EnhancementMode);
    }
  }, [settings?.general?.defaultMode]);

  const handleRoleChange = useCallback((role: EnhancementMode) => {
    setSelectedRole(role);
    updateSettings({ general: { ...settings.general, defaultMode: role } });
  }, [settings, updateSettings]);

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

  const modeConfig = ENHANCEMENT_MODES.find(m => m.id === selectedRole);

  // Primary roles shown as pills (first 8 most common)
  const pillRoles = ENHANCEMENT_MODES.slice(0, 8);

  return (
    <div className="flex flex-col h-[450px]" style={{ background: '#FAFAFE' }}>

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
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{ color: '#8E8EA0', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
          title="Settings"
        >
          <RoleIcon name="Settings" size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* ── Recent Prompt ──────────────────────────────────── */}
      <div className="px-5 pb-4">
        <div
          className="rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer group"
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
                {modeConfig && (
                  <span
                    className="text-[11px] font-medium flex items-center gap-1"
                    style={{ color: modeConfig.color }}
                  >
                    <RoleIcon name={modeConfig.icon} size={11} />
                    {modeConfig.label}
                  </span>
                )}
                <span style={{ color: '#ECE9FF' }}>·</span>
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

      {/* ── Role Selector Pills ────────────────────────────── */}
      <div className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#8E8EA0' }}>
            Role
          </span>
          <span className="text-[11px]" style={{ color: '#c4c4d4' }}>
            {ENHANCEMENT_MODES.length} available
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pillRoles.map((mode, i) => {
            const isSelected = selectedRole === mode.id;
            return (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, duration: 0.15 }}
                onClick={() => handleRoleChange(mode.id)}
                className="flex items-center gap-1.5 transition-all duration-200"
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: isSelected
                    ? 'linear-gradient(135deg, #7C5CFC, #9D7BFF)'
                    : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#1a1a2e',
                  boxShadow: isSelected
                    ? '0 2px 8px rgba(124, 92, 252, 0.25)'
                    : '0 1px 3px rgba(0, 0, 0, 0.04), inset 0 0 0 1px #ECE9FF',
                }}
              >
                <RoleIcon
                  name={mode.icon}
                  size={13}
                  strokeWidth={isSelected ? 2 : 1.75}
                />
                {mode.label}
              </motion.button>
            );
          })}
          {/* More roles button */}
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.15 }}
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex items-center gap-1 transition-all duration-200"
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: '#8E8EA0',
              boxShadow: '0 0 0 1px #ECE9FF inset',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
          >
            <RoleIcon name="Plus" size={12} />
            More
          </motion.button>
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
            { icon: 'Settings', label: 'Settings', action: () => chrome.runtime.openOptionsPage() },
          ].map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.03 }}
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

// ──────────────────────────────────────────────────────────────
// QuickActions — Popup home tab
// ──────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import { ENHANCEMENT_MODES } from '@/constants/modes';
import { RoleIcon } from '../common/RoleIcon';

export const QuickActions: React.FC = () => {
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

  return (
    <div className="p-4 space-y-4">
      {/* Status Card */}
      <div
        className="rounded-xl p-4 border border-slate-200/60"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-700">Extension Active</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Navigate to any supported AI chat platform and start typing to see the enhance button.
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-2.5">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenSidePanel}
            className="p-3 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="text-base mb-1.5 block">📋</span>
            <span className="text-xs font-medium text-slate-800">Full History</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Open side panel</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-3 rounded-xl bg-white border border-slate-200/60 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="text-base mb-1.5 block">⚙️</span>
            <span className="text-xs font-medium text-slate-800">Settings</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Configure extension</p>
          </motion.button>
        </div>
      </div>

      {/* Enhancement Roles Preview */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-2.5">Enhancement Roles</h3>
        <div className="space-y-1.5">
          {ENHANCEMENT_MODES.slice(0, 4).map((mode, i) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-200/60"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
                style={{
                  background: `${mode.color}15`,
                  border: `1px solid ${mode.color}25`,
                  color: mode.color,
                }}
              >
                <RoleIcon name={mode.icon} size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-slate-800">{mode.label}</span>
                <p className="text-[10px] text-slate-400 truncate">{mode.description}</p>
              </div>
            </motion.div>
          ))}
          <p className="text-[10px] text-slate-400/60 text-center pt-1">
            +{ENHANCEMENT_MODES.length - 4} more roles
          </p>
        </div>
      </div>
    </div>
  );
};

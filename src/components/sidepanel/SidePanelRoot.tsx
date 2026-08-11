// ──────────────────────────────────────────────────────────────
// SidePanelRoot — Workspace with segmented tab control
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settings.store';
import { FullHistory } from './FullHistory';
import { Analytics } from './Analytics';
import { RoleIcon } from '../common/RoleIcon';

type SidePanelTab = 'history' | 'analytics';

export const SidePanelRoot: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('history');
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
        <div className="px-5 pt-5 pb-4">
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

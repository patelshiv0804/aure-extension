// ──────────────────────────────────────────────────────────────
// Analytics — Premium analytics dashboard
// ──────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import { ENHANCEMENT_MODES } from '@/constants/modes';
import { AI_MODELS } from '@/constants/models';
import { RoleIcon } from '../common/RoleIcon';

export const Analytics: React.FC = () => {
  const stats = {
    totalEnhancements: 0,
    totalVersions: 0,
    avgImprovement: 0,
    topCategory: 'general',
  };

  const statCards = [
    { label: 'Enhancements', value: stats.totalEnhancements, icon: 'Zap', color: '#7C5CFC' },
    { label: 'Versions', value: stats.totalVersions, icon: 'Layers', color: '#A78BFA' },
    { label: 'Avg Improvement', value: `${stats.avgImprovement}%`, icon: 'BarChart3', color: '#34D399' },
    { label: 'Top Category', value: stats.topCategory, icon: 'Crown', color: '#F59E0B' },
  ];

  return (
    <div className="p-5 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl p-4"
            style={{
              background: '#FFFFFF',
              border: '1px solid #ECE9FF',
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{
                background: `${stat.color}0c`,
                color: stat.color,
              }}
            >
              <RoleIcon name={stat.icon} size={16} strokeWidth={2} />
            </div>
            <div
              className="text-xl font-bold"
              style={{ color: stat.color, letterSpacing: '-0.02em' }}
            >
              {stat.value}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: '#8E8EA0' }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Role Usage */}
      <div>
        <h3
          className="text-[11px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: '#8E8EA0' }}
        >
          Role Usage
        </h3>
        <div className="space-y-2">
          {ENHANCEMENT_MODES.slice(0, 5).map((mode, i) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.03 }}
              className="flex items-center gap-3 py-2"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${mode.color}0c`,
                  color: mode.color,
                }}
              >
                <RoleIcon name={mode.icon} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium" style={{ color: '#1a1a2e' }}>
                    {mode.label}
                  </span>
                  <span className="text-[11px]" style={{ color: '#c4c4d4' }}>
                    0 uses
                  </span>
                </div>
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: '#F0EDF9' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '0%' }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${mode.color}, ${mode.color}88)`,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI Models */}
      <div>
        <h3
          className="text-[11px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: '#8E8EA0' }}
        >
          AI Models Used
        </h3>
        <div className="space-y-1">
          {AI_MODELS.slice(0, 6).map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.03 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
              style={{ cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: model.color || '#A78BFA' }}
              />
              <span className="text-[13px] font-medium flex-1" style={{ color: '#1a1a2e' }}>
                {model.name}
              </span>
              <span className="text-[11px]" style={{ color: '#c4c4d4' }}>
                0 prompts
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div
        className="text-center py-5 rounded-xl"
        style={{
          background: '#F5F3FF',
          border: '1px dashed #ECE9FF',
        }}
      >
        <p className="text-[12px]" style={{ color: '#8E8EA0' }}>
          Analytics will populate as you enhance prompts
        </p>
      </div>
    </div>
  );
};

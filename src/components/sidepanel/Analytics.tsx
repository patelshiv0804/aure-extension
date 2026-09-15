// ──────────────────────────────────────────────────────────────
// Analytics — Premium analytics dashboard
// Directly matching Prompt_Enhancer-FE KPI stat cards & visual design
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Zap, Star } from 'lucide-react';
import { ENHANCEMENT_MODES } from '@/constants/modes';
import { AI_MODELS } from '@/constants/models';
import { RoleIcon } from '../common/RoleIcon';
import { useTheme } from '@/hooks/useTheme';
import { sendMessage } from '@/lib/messaging';
import type { Prompt } from '@/types/prompt';

interface AnalyticsProps {
  onNavigateHistory?: () => void;
}

interface StatCardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  accent: string;
  sub?: React.ReactNode;
  sparkline?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  accent,
  sub,
  sparkline,
}) => {
  const { isDark, D } = useTheme();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl p-4 transition-all flex flex-col justify-between"
      style={{
        background: isDark ? 'rgba(20, 19, 32, 0.85)' : '#FFFFFF',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(124, 58, 237, 0.10)'}`,
        boxShadow: isDark
          ? '0 4px 20px rgba(0, 0, 0, 0.4)'
          : '0 4px 12px rgba(109, 40, 217, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        minHeight: 120,
      }}
    >
      <div>
        {/* Top Header: Label & Icon Badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.9px]"
            style={{ color: isDark ? D.textMuted : '#64748B' }}
          >
            {label}
          </span>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              color: accent,
              background: `${accent}1a`,
              border: `1px solid ${accent}2e`,
            }}
          >
            <Icon size={14} strokeWidth={2} />
          </div>
        </div>

        {/* Large Stat Number */}
        <div
          className="text-3xl font-extrabold tracking-tight leading-none"
          style={{ color: accent }}
        >
          {prefix}
          {value}
          {suffix}
        </div>
      </div>

      {/* Sub Elements: Progress bar, Sparkline, or Action button */}
      <div className="mt-2">
        {sub}
        {sparkline && (
          <svg
            viewBox="0 0 90 24"
            preserveAspectRatio="none"
            className="w-full h-5 mt-1"
          >
            <polyline
              points="0,20 12,16 22,18 34,9 46,13 58,5 70,7 80,3 90,2"
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </motion.div>
  );
};

export const Analytics: React.FC<AnalyticsProps> = ({ onNavigateHistory }) => {
  const { isDark, D } = useTheme();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await sendMessage('GET_HISTORY', { timeRange: 'all', limit: 100 });
        if (isMounted && res?.prompts) {
          setPrompts(res.prompts);
        }
      } catch (err) {
        console.warn('[Analytics] Failed to fetch prompts:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute stats
  const totalPrompts = prompts.length;

  // Average score
  const scores = prompts
    .map((p) => p.analysisData?.afterScore)
    .filter((s): s is number => typeof s === 'number');
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : totalPrompts > 0
    ? 89
    : 0;

  // Prompts created this week (last 7 days)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeekCount = prompts.filter(
    (p) => new Date(p.createdAt).getTime() >= oneWeekAgo
  ).length;

  // Favorites count
  const favoritesCount = prompts.filter((p) => (p as any).isFavorite).length;

  // Role usage frequency
  const modeCounts = prompts.reduce((acc, p) => {
    const mode = p.mode || 'general';
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-5 space-y-6">
      {/* ── 4 KPI Stats Grid (Directly matching Prompt_Enhancer-FE) ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* 1. Total Prompts */}
        <StatCard
          label="Total Prompts"
          value={totalPrompts}
          icon={Sparkles}
          accent="#8B5CF6"
        />

        {/* 2. Avg Score */}
        <StatCard
          label="Avg Score"
          value={avgScore}
          suffix="%"
          icon={TrendingUp}
          accent="#10B981"
          sub={
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{
                background: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, Math.max(0, avgScore))}%`,
                  background: '#10B981',
                }}
              />
            </div>
          }
        />

        {/* 3. This Week */}
        <StatCard
          label="This Week"
          value={thisWeekCount}
          prefix="+"
          icon={Zap}
          accent="#38BDF8"
          sparkline
        />

        {/* 4. Favorites */}
        <StatCard
          label="Favorites"
          value={favoritesCount}
          icon={Star}
          accent="#F59E0B"
          sub={
            <button
              onClick={onNavigateHistory}
              className="text-[11px] font-semibold transition-all hover:underline flex items-center gap-0.5 cursor-pointer"
              style={{ color: isDark ? '#C084FC' : '#7C3AED' }}
            >
              View all →
            </button>
          }
        />
      </div>

      {/* ── Role Usage ────────────────────────────────────────── */}
      <div>
        <h3
          className="text-[11px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: isDark ? D.textMuted : '#8E8EA0' }}
        >
          Role Usage
        </h3>
        <div className="space-y-2">
          {ENHANCEMENT_MODES.slice(0, 5).map((mode, i) => {
            const count = modeCounts[mode.id] || 0;
            const pct = totalPrompts > 0 ? Math.round((count / totalPrompts) * 100) : 0;

            return (
              <motion.div
                key={mode.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.03 }}
                className="flex items-center gap-3 py-2"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isDark ? 'rgba(139, 92, 246, 0.15)' : `${mode.color}0c`,
                    color: mode.color,
                  }}
                >
                  <RoleIcon name={mode.icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}
                    >
                      {mode.label}
                    </span>
                    <span className="text-[11px]" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>
                      {count} {count === 1 ? 'use' : 'uses'}
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: isDark ? D.surface2 : '#F0EDF9' }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${mode.color}, ${mode.color}88)`,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── AI Models ─────────────────────────────────────────── */}
      <div>
        <h3
          className="text-[11px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: isDark ? D.textMuted : '#8E8EA0' }}
        >
          AI Models Used
        </h3>
        <div className="space-y-1">
          {AI_MODELS.slice(0, 6).map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.03 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-default"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? D.surfaceElevated : '#F5F3FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: model.color || '#A78BFA' }}
              />
              <span
                className="text-[13px] font-medium flex-1"
                style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}
              >
                {model.name}
              </span>
              <span className="text-[11px]" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>
                0 prompts
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

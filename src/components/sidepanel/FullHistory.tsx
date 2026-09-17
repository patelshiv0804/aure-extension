// ──────────────────────────────────────────────────────────────
// FullHistory — Premium side panel history view
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Award, Medal, Sparkles } from 'lucide-react';
import { sendMessage } from '@/lib/messaging';
import { useAuthStore } from '@/stores/auth.store';
import { VersionTimeline } from '@/components/popup/VersionTimeline';
import type { Prompt, PromptHistoryFilters } from '@/types/prompt';
import { MODE_MAP } from '@/constants/modes';
import { RoleIcon } from '../common/RoleIcon';
import { useTheme } from '@/hooks/useTheme';
interface FullHistoryProps {
  onSignIn?: () => void;
}

export const FullHistory: React.FC<FullHistoryProps> = ({ onSignIn }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<PromptHistoryFilters['timeRange']>('all');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const { isAuthenticated, loadAuth } = useAuthStore();
  const { isDark, D, L } = useTheme();


  const handleDeletePrompt = async (promptId: string) => {
    setIsDeletingId(promptId);
    try {
      await sendMessage('DELETE_PROMPT', { promptId });
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
      if (selectedPromptId === promptId) {
        setSelectedPromptId(null);
      }
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('[AURE] Failed to hard delete prompt:', error);
    } finally {
      setIsDeletingId(null);
    }
  };

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setPrompts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await sendMessage('GET_HISTORY', {
        timeRange: timeFilter,
        search: searchQuery || undefined,
        limit: 50,
      });
      setPrompts(result.prompts || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter, searchQuery, isAuthenticated]);

  useEffect(() => {
    loadAuth();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local') {
        if (changes['userProfile'] || changes['currentUserEmail']) {
          loadAuth();
        }
        if (changes['last_history_update']) {
          fetchHistory();
        }
      }
    };

    const handleRuntimeMessage = (message: any) => {
      if (message?.type === 'HISTORY_UPDATED') {
        fetchHistory();
      }
    };

    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener(handleStorageChange);
      }
      if (chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);
      }
      return () => {
        if (chrome.storage?.onChanged) {
          chrome.storage.onChanged.removeListener(handleStorageChange);
        }
        if (chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
        }
      };
    }
  }, [loadAuth, fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filters = [
    { value: 'all' as const, label: 'All' },
    { value: 'today' as const, label: 'Today' },
    { value: 'week' as const, label: 'Week' },
    { value: 'month' as const, label: 'Month' },
  ];

  return (
    <div className="p-3.5 space-y-2.5">
      {/* Search */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: isDark ? D.textMuted : '#8E8EA0' }}>
          <RoleIcon name="Search" size={13.5} strokeWidth={1.8} />
        </div>
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none transition-all duration-150"
          style={{
            background: isDark ? D.surface : '#FFFFFF',
            border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
            color: isDark ? D.textPrimary : '#1a1a2e',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(124, 92, 252, 0.12)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = isDark ? (D.border as string) : '#ECE9FF'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Filter Pills & Vault Action Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => {
            const isSelected = timeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setTimeFilter(f.value)}
                className="transition-all duration-150 cursor-pointer"
                style={{
                  padding: '3px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: isSelected ? 600 : 500,
                  border: 'none',
                  background: isSelected
                    ? (isDark ? '#8B5CF6' : '#7C3AED')
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                  color: isSelected ? '#FFFFFF' : (isDark ? D.textSecondary : '#64748B'),
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>


      </div>



      {/* Results */}
      {!isAuthenticated ? (
        <div
          className="text-center py-14 px-4 flex flex-col items-center gap-3.5 rounded-2xl shadow-xs"
          style={{
            background: isDark ? D.surface : '#FFFFFF',
            border: `1px solid ${isDark ? D.border : '#ECE9FF'}`,
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
              color: isDark ? '#C084FC' : '#7C3AED',
            }}
          >
            <RoleIcon name="User" size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-[14px] font-bold" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
              Sign In Required
            </p>
            <p className="text-[12px] max-w-[220px]" style={{ color: isDark ? D.textSecondary : '#8E8EA0' }}>
              Please sign in to view your prompt history and sync prompts across devices.
            </p>
          </div>
          <button
            onClick={() => onSignIn?.()}
            className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all cursor-pointer hover:opacity-90"
            style={{ background: '#7C3AED' }}
          >
            Sign In to AURE
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: isDark ? D.surface2 : '#F0EDF9' }}
            />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
              color: isDark ? '#C084FC' : '#A78BFA',
            }}
          >
            <RoleIcon name="FileText" size={22} />
          </div>
          <div>
            <p className="text-[14px] font-medium" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
              No prompts found
            </p>
            <p className="text-[12px] mt-1" style={{ color: isDark ? D.textMuted : '#8E8EA0' }}>
              Enhanced prompts will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {prompts.map((prompt, i) => {
            const modeConfig = MODE_MAP[prompt.mode];
            const isSelected = selectedPromptId === prompt.id;
            const beforeScore = prompt.analysisData?.beforeScore ?? 65;
            const afterScore = prompt.analysisData?.afterScore ?? prompt.successScore ?? 94;
            const diffScore = Math.max(0, afterScore - beforeScore);
            const recommendations = prompt.analysisData?.recommendations ?? [
              { name: 'Claude', rank: 1, url: 'https://claude.ai/' },
              { name: 'ChatGPT', rank: 2, url: 'https://chatgpt.com/' },
              { name: 'Gemini', rank: 3, url: 'https://gemini.google.com/' },
            ];

            return (
              <motion.div
                key={prompt.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <div
                  onClick={() => setSelectedPromptId(isSelected ? null : prompt.id)}
                  className="rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    padding: '10px 12px',
                    background: isSelected
                      ? isDark ? 'rgba(139, 92, 246, 0.16)' : '#F5F3FF'
                      : isDark ? D.surface : '#FFFFFF',
                    border: `1px solid ${
                      isSelected ? '#8B5CF6' : (isDark ? D.border : '#ECE9FF')
                    }`,
                    boxShadow: isSelected
                      ? '0 2px 8px rgba(124, 58, 237, 0.12)'
                      : isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isDark ? D.surfaceElevated : '#FAFAFE';
                      e.currentTarget.style.borderColor = '#8B5CF6';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isDark ? D.surface : '#FFFFFF';
                      e.currentTarget.style.borderColor = isDark ? (D.border as string) : '#ECE9FF';
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-[12.5px] font-medium line-clamp-1 leading-snug"
                        style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
                      >
                        {prompt.title || prompt.originalText.slice(0, 60)}
                      </h3>
                      <p
                        className="text-[11px] line-clamp-1 mt-0.5 leading-normal"
                        style={{ color: isDark ? D.textSecondary : '#64748B' }}
                      >
                        {prompt.originalText}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        {modeConfig && (
                          <span
                            className="text-[10px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                            style={{
                              background: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
                              border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.2)' : '#ECE9FF'}`,
                              color: isDark ? '#C084FC' : '#7C3AED',
                            }}
                          >
                            <RoleIcon name={modeConfig.icon} size={10} />
                            {modeConfig.label}
                          </span>
                        )}
                        {prompt.versionNumber && prompt.versionNumber > 1 && (
                          <span
                            className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                            style={{
                              background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                              color: isDark ? '#34D399' : '#059669',
                              border: `1px solid ${isDark ? 'rgba(52, 211, 153, 0.25)' : '#A7F3D0'}`,
                            }}
                            title={`Re-enhanced to Version ${prompt.versionNumber}`}
                          >
                            <span>v{prompt.versionNumber}</span>
                          </span>
                        )}
                        {prompt.platform && prompt.platform.toLowerCase() !== 'promptiq' && (
                          <>
                            <span className="text-[10px] font-medium" style={{ color: isDark ? D.textMuted : '#8E8EA0' }}>
                              {prompt.platform}
                            </span>
                            <span className="text-[9px]" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#C4C4D4' }}>•</span>
                          </>
                        )}
                        <span className="text-[10px]" style={{ color: isDark ? D.textMuted : '#8E8EA0' }}>
                          {new Date(prompt.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Score Comparison Badge, Delete Button & Toggle */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                          style={{
                            background: isDark ? D.surface2 : '#F8FAFC',
                            border: `1px solid ${isDark ? D.border : '#E2E8F0'}`,
                          }}
                        >
                          <span className="text-[10.5px] font-medium" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                            {beforeScore}
                          </span>
                          <RoleIcon name="ArrowRight" size={9} className="text-slate-400" />
                          <span className="text-[11px] font-bold" style={{ color: isDark ? '#C084FC' : '#7C3AED' }}>
                            {afterScore}
                          </span>
                          {diffScore > 0 && (
                            <span
                              className="text-[9.5px] font-bold px-1 py-0.2 rounded-full"
                              style={{
                                background: isDark ? 'rgba(52, 211, 153, 0.2)' : '#ECFDF5',
                                color: isDark ? '#34D399' : '#059669',
                              }}
                            >
                              +{diffScore}
                            </span>
                          )}
                        </div>

                        {/* Hard Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(prompt.id);
                          }}
                          title="Permanently Delete Prompt"
                          className="p-1 rounded-lg transition-all cursor-pointer"
                          style={{
                            color: isDark ? D.textMuted : '#94A3B8',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#F43F5E';
                            e.currentTarget.style.background = isDark ? 'rgba(244, 63, 94, 0.15)' : '#FFF1F2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = isDark ? (D.textMuted as string) : '#94A3B8';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <RoleIcon name="Trash2" size={13} />
                        </button>
                      </div>

                      <div style={{ color: isDark ? D.textMuted : '#C4C4D4' }} className="flex items-center gap-0.5 text-[10px]">
                        <span>{isSelected ? 'Less' : 'Details'}</span>
                        <RoleIcon name={isSelected ? 'ChevronDown' : 'ChevronRight'} size={12} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Analysis Breakdown & Version Timeline */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-3 p-3.5 rounded-b-xl border-x border-b"
                      style={{
                        background: isDark ? D.surface2 : 'rgba(248, 250, 252, 0.8)',
                        borderColor: isDark ? D.border : 'rgba(167, 139, 250, 0.4)',
                      }}
                    >

                      {/* Interactive Recommended AI Models — Dark Theme Ranked Cards */}
                      <div
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, #141320 0%, #1A1827 100%)'
                            : 'linear-gradient(135deg, #1E1B4B 0%, #1a1a3e 100%)',
                          border: `1px solid ${isDark ? D.border : 'rgba(139, 92, 246, 0.3)'}`,
                          borderRadius: 18,
                          padding: '12px 14px',
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: '#7C3AED',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.35)',
                              flexShrink: 0,
                            }}
                          >
                            <Sparkles size={13} className="text-white" strokeWidth={2.2} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                              Best AI For This Prompt
                            </p>
                            <p style={{ fontSize: 9.5, color: '#94A3B8', margin: 0 }}>Click to open in browser</p>
                          </div>
                        </div>

                        {/* Ranked Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {recommendations.map((rec) => {
                            const rankConfig: Record<number, { Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; accent: string; glowColor: string; label: string; rankBg: string }> = {
                              1: {
                                Icon: Trophy,
                                accent: '#F59E0B',
                                glowColor: 'rgba(245,158,11,0.15)',
                                label: 'Best Match',
                                rankBg: 'rgba(245,158,11,0.15)',
                              },
                              2: {
                                Icon: Award,
                                accent: '#94A3B8',
                                glowColor: 'rgba(148,163,184,0.1)',
                                label: '2nd Choice',
                                rankBg: 'rgba(148,163,184,0.15)',
                              },
                              3: {
                                Icon: Medal,
                                accent: '#CD7C4A',
                                glowColor: 'rgba(205,124,74,0.12)',
                                label: '3rd Choice',
                                rankBg: 'rgba(205,124,74,0.15)',
                              },
                            };
                            const cfg = rankConfig[rec.rank] ?? rankConfig[3];
                            const RankIcon = cfg.Icon;
                            return (
                              <a
                                key={rec.name}
                                href={rec.url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Open ${rec.name}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '7px 10px',
                                  borderRadius: 10,
                                  background: `rgba(255,255,255,0.04)`,
                                  border: `1px solid rgba(255,255,255,0.07)`,
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease, transform 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = `rgba(124,92,252,0.12)`;
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.35)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = `rgba(255,255,255,0.04)`;
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)';
                                }}
                              >
                                {/* Rank Icon */}
                                <div
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    background: cfg.rankBg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: cfg.accent,
                                    flexShrink: 0,
                                  }}
                                >
                                  <RankIcon size={13} strokeWidth={2.2} />
                                </div>

                                {/* Name & label */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: '#F1F5F9', letterSpacing: '-0.01em' }}>
                                    {rec.name}
                                  </p>
                                  <p style={{ margin: 0, fontSize: 9.5, color: cfg.accent, fontWeight: 500 }}>
                                    {cfg.label}
                                  </p>
                                </div>

                                {/* Rank pill + link icon */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      color: cfg.accent,
                                      background: cfg.rankBg,
                                      borderRadius: 5,
                                      padding: '1.5px 6px',
                                    }}
                                  >
                                    #{rec.rank}
                                  </span>
                                  <span style={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                                    <RoleIcon name="ExternalLink" size={10} />
                                  </span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>

                      {/* Version Timeline */}
                      <VersionTimeline promptId={prompt.id} analysisData={prompt.analysisData} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Permanent Hard Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[320px] rounded-2xl p-5 shadow-2xl space-y-4 font-sans"
              style={{
                background: isDark ? D.surface : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.3)' : '#FEE2E2'}`,
                boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.65)' : '0 10px 25px rgba(0,0,0,0.12)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                  style={{
                    background: isDark ? 'rgba(244, 63, 94, 0.18)' : '#FFF1F2',
                    color: '#F43F5E',
                    border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.3)' : '#FECDD3'}`,
                  }}
                >
                  <RoleIcon name="Trash2" size={20} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold leading-tight" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                    Delete Prompt?
                  </h4>
                  <p className="text-[11.5px] mt-0.5" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                    Are you sure you want to delete this prompt?
                  </p>
                </div>
              </div>

              <div
                className="text-[11px] p-3 rounded-xl leading-relaxed font-medium"
                style={{
                  background: isDark ? 'rgba(244, 63, 94, 0.12)' : '#FFF1F2',
                  color: isDark ? '#FDA4AF' : '#BE123C',
                  border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.2)' : '#FECDD3'}`,
                }}
              >
                ⚠️ This will <strong>permanently hard delete</strong> this prompt and all its versions. This action cannot be undone.
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeletingId !== null}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                  style={{
                    background: isDark ? D.surface2 : '#F1F5F9',
                    color: isDark ? D.textSecondary : '#475569',
                    border: `1px solid ${isDark ? D.border : '#E2E8F0'}`,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirmId && handleDeletePrompt(deleteConfirmId)}
                  disabled={isDeletingId !== null}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingId === deleteConfirmId ? (
                    <>
                      <RoleIcon name="Loader2" size={14} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
};

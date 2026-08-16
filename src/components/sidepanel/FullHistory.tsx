// ──────────────────────────────────────────────────────────────
// FullHistory — Premium side panel history view
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import { useAuthStore } from '@/stores/auth.store';
import { VersionTimeline } from '@/components/popup/VersionTimeline';
import type { Prompt, PromptHistoryFilters } from '@/types/prompt';
import { MODE_MAP } from '@/constants/modes';
import { RoleIcon } from '../common/RoleIcon';

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
        if (
          changes['userProfile'] ||
          changes['promptiq_token'] ||
          changes['apiToken'] ||
          changes['currentUserEmail']
        ) {
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
    <div className="p-5 space-y-4">
      {/* Search */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8E8EA0' }}>
          <RoleIcon name="Search" size={15} strokeWidth={1.75} />
        </div>
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all duration-200"
          style={{
            background: '#FFFFFF',
            border: '1px solid #ECE9FF',
            color: '#1a1a2e',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#A78BFA'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 92, 252, 0.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#ECE9FF'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Filter Pills */}
      <div className="flex gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setTimeFilter(f.value)}
            className="transition-all duration-200"
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: timeFilter === f.value ? 600 : 500,
              cursor: 'pointer',
              border: 'none',
              background: timeFilter === f.value
                ? 'linear-gradient(135deg, #7C5CFC, #9D7BFF)'
                : 'transparent',
              color: timeFilter === f.value ? '#FFFFFF' : '#8E8EA0',
              boxShadow: timeFilter === f.value
                ? '0 2px 6px rgba(124, 92, 252, 0.2)'
                : '0 0 0 1px #ECE9FF inset',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {!isAuthenticated ? (
        <div className="text-center py-14 px-4 flex flex-col items-center gap-3.5 bg-white border border-[#ECE9FF] rounded-2xl shadow-xs">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: '#F5F3FF', color: '#7C5CFC' }}
          >
            <RoleIcon name="User" size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-[14px] font-bold text-[#1a1a2e]">Sign In Required</p>
            <p className="text-[12px] text-[#8E8EA0] max-w-[220px]">
              Please sign in to view your prompt history and sync prompts across devices.
            </p>
          </div>
          <button
            onClick={() => onSignIn?.()}
            className="mt-1 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)' }}
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
              style={{ background: '#F0EDF9' }}
            />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: '#F5F3FF', color: '#A78BFA' }}
          >
            <RoleIcon name="FileText" size={22} />
          </div>
          <div>
            <p className="text-[14px] font-medium" style={{ color: '#1a1a2e' }}>No prompts found</p>
            <p className="text-[12px] mt-1" style={{ color: '#8E8EA0' }}>
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
            const dimensions = prompt.analysisData?.dimensions ?? [
              { name: 'Clarity', before: 85, after: 95 },
              { name: 'Context', before: 40, after: 100 },
              { name: 'Role', before: 10, after: 100 },
              { name: 'Format', before: 30, after: 100 },
              { name: 'Constraints', before: 20, after: 98 },
              { name: 'Examples', before: 0, after: 100 },
            ];
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
                  className="rounded-xl transition-all duration-200 cursor-pointer"
                  style={{
                    padding: '14px 16px',
                    background: isSelected ? '#F5F3FF' : '#FFFFFF',
                    border: `1px solid ${isSelected ? '#A78BFA' : '#ECE9FF'}`,
                    boxShadow: isSelected ? '0 2px 8px rgba(124, 92, 252, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#FAFAFE';
                      e.currentTarget.style.borderColor = '#DDD6FE';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#ECE9FF';
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-[13.5px] font-semibold line-clamp-1"
                        style={{ color: '#1a1a2e', letterSpacing: '-0.01em' }}
                      >
                        {prompt.title || prompt.originalText.slice(0, 60)}
                      </h3>
                      <p
                        className="text-[12px] line-clamp-1 mt-1"
                        style={{ color: '#8E8EA0' }}
                      >
                        {prompt.originalText}
                      </p>

                      <div className="flex items-center gap-2.5 mt-2.5">
                        {modeConfig && (
                          <span
                            className="text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg"
                            style={{
                              background: '#F5F3FF',
                              border: '1px solid #ECE9FF',
                              color: '#7C5CFC',
                            }}
                          >
                            <RoleIcon name={modeConfig.icon} size={11} />
                            {modeConfig.label}
                          </span>
                        )}
                        <span className="text-[11px] font-medium" style={{ color: '#8E8EA0' }}>
                          {prompt.platform}
                        </span>
                        <span className="text-[10px]" style={{ color: '#C4C4D4' }}>•</span>
                        <span className="text-[11px]" style={{ color: '#8E8EA0' }}>
                          {new Date(prompt.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Score Comparison Badge, Delete Button & Toggle */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
                          <span className="text-[11px] font-semibold text-slate-500">{beforeScore}</span>
                          <RoleIcon name="ArrowRight" size={10} className="text-slate-400" />
                          <span className="text-xs font-bold text-indigo-600">{afterScore}</span>
                          {diffScore > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60">
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
                          className="p-1.5 rounded-xl border border-transparent hover:border-rose-200/80 bg-transparent hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                        >
                          <RoleIcon name="Trash2" size={14} />
                        </button>
                      </div>

                      <div style={{ color: '#C4C4D4' }} className="flex items-center gap-1 text-[11px]">
                        <span>{isSelected ? 'Less' : 'Details'}</span>
                        <RoleIcon name={isSelected ? 'ChevronDown' : 'ChevronRight'} size={14} />
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
                      className="overflow-hidden space-y-3 p-3.5 bg-slate-50/60 border-x border-b border-purple-200/60 rounded-b-xl"
                    >

                      {/* Interactive Recommended AI Models — Dark Theme Ranked Cards */}
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #1E1B4B 0%, #1a1a3e 100%)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: 18,
                          padding: '12px 14px',
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontSize: 14 }}>✨</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                              Best AI For This Prompt
                            </p>
                            <p style={{ fontSize: 10, color: '#6D5BD0', margin: 0 }}>Click to open in browser</p>
                          </div>
                        </div>

                        {/* Ranked Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {recommendations.map((rec) => {
                            const rankConfig: Record<number, { badge: string; accent: string; glowColor: string; label: string; rankBg: string }> = {
                              1: {
                                badge: '🥇',
                                accent: '#F59E0B',
                                glowColor: 'rgba(245,158,11,0.15)',
                                label: 'Best Match',
                                rankBg: 'rgba(245,158,11,0.15)',
                              },
                              2: {
                                badge: '🥈',
                                accent: '#94A3B8',
                                glowColor: 'rgba(148,163,184,0.1)',
                                label: '2nd Choice',
                                rankBg: 'rgba(148,163,184,0.15)',
                              },
                              3: {
                                badge: '🥉',
                                accent: '#CD7C4A',
                                glowColor: 'rgba(205,124,74,0.12)',
                                label: '3rd Choice',
                                rankBg: 'rgba(205,124,74,0.15)',
                              },
                            };
                            const cfg = rankConfig[rec.rank] ?? rankConfig[3];
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
                                  gap: 10,
                                  padding: '9px 12px',
                                  borderRadius: 12,
                                  background: `rgba(255,255,255,0.05)`,
                                  border: `1px solid rgba(255,255,255,0.08)`,
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease, transform 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = `rgba(124,92,252,0.15)`;
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = `rgba(255,255,255,0.05)`;
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                                }}
                              >
                                {/* Medal */}
                                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{cfg.badge}</span>

                                {/* Name & label */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.01em' }}>
                                    {rec.name}
                                  </p>
                                  <p style={{ margin: 0, fontSize: 10, color: cfg.accent, fontWeight: 600 }}>
                                    {cfg.label}
                                  </p>
                                </div>

                                {/* Rank pill + link icon */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      color: cfg.accent,
                                      background: cfg.rankBg,
                                      borderRadius: 6,
                                      padding: '2px 7px',
                                    }}
                                  >
                                    #{rec.rank}
                                  </span>
                                  <span style={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                                    <RoleIcon name="ExternalLink" size={11} />
                                  </span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>

                      {/* Version Timeline with Fixed height scrollable box & Auto-Fill button */}

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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[320px] bg-white rounded-2xl p-5 border border-rose-100 shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
                  <RoleIcon name="Trash2" size={20} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900 leading-tight">Delete Prompt?</h4>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">Are you sure you want to delete this prompt?</p>
                </div>
              </div>

              <div className="text-[11px] text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-100/80 leading-relaxed font-medium">
                ⚠️ This will <strong>permanently hard delete</strong> this prompt and all its versions. This action cannot be undone.
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeletingId !== null}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
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

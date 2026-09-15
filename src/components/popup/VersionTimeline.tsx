// ──────────────────────────────────────────────────────────────
// VersionTimeline — Modern Big-Window Version History View
// Replaces cluttered timeline lines with spacious version cards & switcher
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import type { PromptVersion, PromptAnalysisData } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';
import { useTheme } from '@/hooks/useTheme';

interface VersionTimelineProps {
  promptId: string;
  analysisData?: PromptAnalysisData;
}

// Directly inject prompt into the active ChatGPT / Claude / Gemini tab
const AI_HOSTS = [
  'chatgpt.com', 'chat.openai.com', 'claude.ai',
  'gemini.google.com', 'perplexity.ai', 'grok.com',
  'deepseek.com', 'copilot.microsoft.com',
];

/** True only for URLs on a supported AI platform. */
function isAiHostUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return AI_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function findTargetTab(): Promise<chrome.tabs.Tab | undefined> {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (isAiHostUrl(activeTab?.url)) return activeTab;

  const activeTabs = await chrome.tabs.query({ active: true });
  const activeAI = activeTabs.find((t) => isAiHostUrl(t.url));
  if (activeAI) return activeAI;

  const aiTabs = await chrome.tabs.query({ url: AI_HOSTS.map((h) => `*://${h}/*`) });
  if (aiTabs.length) return aiTabs[0];

  return undefined;
}

async function fillPromptInTab(text: string): Promise<boolean> {
  try {
    const target = await findTargetTab();
    if (!target?.id) return false;

    try {
      await chrome.tabs.sendMessage(target.id, { type: 'FILL_PROMPT', payload: { text } });
      return true;
    } catch {
      return false;
    }
  } catch (err) {
    console.error('[AURE] fillPromptInTab error:', err);
    return false;
  }
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({ promptId, analysisData }) => {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filledId, setFilledId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | 'all'>('all');
  const { isDark, D } = useTheme();

  useEffect(() => {
    let isMounted = true;
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const result = await sendMessage('GET_VERSIONS', { promptId });
        if (isMounted && result?.versions) {
          setVersions(result.versions);
          // If multiple versions exist, default to the latest enhanced version
          if (result.versions.length > 0) {
            const latest = result.versions[result.versions.length - 1];
            setSelectedVersionId(latest.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch versions:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchVersions();
    return () => {
      isMounted = false;
    };
  }, [promptId]);

  const handleCopy = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleAutoFill = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(text).catch(() => {});
      const success = await fillPromptInTab(text);
      setFilledId(id);
      setTimeout(() => setFilledId(null), 2500);

      if (!success) {
        console.warn('[AURE] Fill prompt fallback: text copied to clipboard, paste with Ctrl+V');
      }
    } catch (err) {
      console.error('Failed to auto fill prompt:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl animate-pulse"
            style={{
              background: isDark ? D.surface2 : '#F1F5F9',
              border: `1px solid ${isDark ? D.borderSubtle : '#E2E8F0'}`,
            }}
          />
        ))}
      </div>
    );
  }

  if (!versions.length) {
    return null;
  }

  // Filter versions to display
  const displayedVersions =
    selectedVersionId === 'all'
      ? versions
      : versions.filter((v) => v.id === selectedVersionId);

  return (
    <div
      className="p-4 rounded-2xl my-2 transition-colors space-y-4 w-full max-w-full overflow-hidden"
      style={{
        background: isDark ? 'rgba(20, 19, 32, 0.75)' : '#F8FAFC',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.9)'}`,
      }}
    >
      {/* ── Header: Title & Version Count ────────────────────── */}
      <div
        className="flex items-center justify-between gap-2 border-b pb-3"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <h3
            className="text-[13px] font-bold"
            style={{ color: isDark ? D.textPrimary : '#1E293B' }}
          >
            Drafts & Versions
          </h3>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#EDE9FE',
              color: isDark ? '#C084FC' : '#7C3AED',
            }}
          >
            {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </span>
        </div>

        {versions.length > 1 && (
          <span
            className="text-[11px] font-medium"
            style={{ color: isDark ? D.textMuted : '#94A3B8' }}
          >
            {selectedVersionId === 'all'
              ? 'All versions'
              : `Viewing V${versions.find((v) => v.id === selectedVersionId)?.version ?? ''}`}
          </span>
        )}
      </div>

      {/* ── Switcher Tabs (Full Width, Zero Overflow) ───────── */}
      {versions.length > 1 && (
        <div
          className="flex items-center gap-1 p-1 rounded-xl w-full max-w-full overflow-x-auto no-scrollbar"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
          }}
        >
          {versions.map((v) => {
            const isSelected = selectedVersionId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className="flex-1 min-w-[56px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{
                  background: isSelected
                    ? isDark
                      ? 'rgba(139, 92, 246, 0.3)'
                      : '#FFFFFF'
                    : 'transparent',
                  color: isSelected
                    ? isDark
                      ? '#FFFFFF'
                      : '#7C3AED'
                    : isDark
                    ? D.textMuted
                    : '#64748B',
                  boxShadow: isSelected
                    ? isDark
                      ? '0 2px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(139, 92, 246, 0.4)'
                      : '0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(124, 58, 237, 0.15)'
                    : 'none',
                }}
              >
                <span>V{v.version}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background:
                      v.source === 'enhanced'
                        ? '#10B981'
                        : v.source === 'edited'
                        ? '#F59E0B'
                        : isDark
                        ? 'rgba(255,255,255,0.4)'
                        : '#94A3B8',
                  }}
                  title={v.source}
                />
              </button>
            );
          })}

          <button
            onClick={() => setSelectedVersionId('all')}
            className="flex-1 min-w-[44px] py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center cursor-pointer whitespace-nowrap"
            style={{
              background:
                selectedVersionId === 'all'
                  ? isDark
                    ? 'rgba(139, 92, 246, 0.3)'
                    : '#FFFFFF'
                  : 'transparent',
              color:
                selectedVersionId === 'all'
                  ? isDark
                    ? '#FFFFFF'
                    : '#7C3AED'
                  : isDark
                  ? D.textMuted
                  : '#64748B',
              boxShadow:
                selectedVersionId === 'all'
                  ? isDark
                    ? '0 2px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(139, 92, 246, 0.4)'
                    : '0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(124, 58, 237, 0.15)'
                  : 'none',
            }}
            title="View all versions stacked"
          >
            All
          </button>
        </div>
      )}

      {/* ── Version Cards (Big Window Container) ─────────────── */}
      <div className="space-y-4">
        {displayedVersions.map((version, i) => {
          const isExpanded = expandedVersionId === version.id;
          const isFilled = filledId === version.id;
          const isCopied = copiedId === version.id;
          const curAnalysis = version.analysisData ?? analysisData;

          return (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl p-4 transition-all"
              style={{
                background: isDark ? D.surfaceElevated : '#FFFFFF',
                border: `1px solid ${
                  version.source === 'enhanced'
                    ? isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(124, 58, 237, 0.2)'
                    : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.9)'
                }`,
                boxShadow: isDark
                  ? '0 4px 20px rgba(0,0,0,0.35)'
                  : '0 2px 10px rgba(109, 40, 217, 0.04)',
              }}
            >
              {/* Card Header Bar: All 4 items in one clean line */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="px-2.5 py-1 text-xs font-extrabold rounded-lg flex-shrink-0"
                    style={{
                      background:
                        version.source === 'enhanced'
                          ? 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)'
                          : isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                      color: '#FFFFFF',
                    }}
                  >
                    V{version.version}
                  </span>

                  <span
                    className="px-2 py-0.5 text-[11px] font-semibold rounded-full capitalize flex-shrink-0"
                    style={{
                      backgroundColor:
                        version.source === 'enhanced'
                          ? isDark ? 'rgba(139, 92, 246, 0.18)' : '#EDE9FE'
                          : version.source === 'edited'
                          ? isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7'
                          : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      color:
                        version.source === 'enhanced'
                          ? isDark ? '#C084FC' : '#7C3AED'
                          : version.source === 'edited'
                          ? isDark ? '#FBBF24' : '#D97706'
                          : isDark ? D.textMuted : '#64748B',
                      border: `1px solid ${
                        version.source === 'enhanced'
                          ? isDark ? 'rgba(139, 92, 246, 0.35)' : 'rgba(167, 139, 250, 0.5)'
                          : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 0.8)'
                      }`,
                    }}
                  >
                    {version.source}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => handleAutoFill(e, version.text, version.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                    }}
                    title="Auto-fill in active AI Chat Input"
                  >
                    <RoleIcon name={isFilled ? 'Check' : 'ArrowUpRight'} size={13} strokeWidth={2.5} />
                    <span>{isFilled ? 'Filled!' : 'Fill Input'}</span>
                  </button>

                  <button
                    onClick={(e) => handleCopy(e, version.text, version.id)}
                    className="p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    style={{
                      color: isCopied ? '#10B981' : isDark ? D.textMuted : '#64748B',
                      background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}`,
                    }}
                    title="Copy Prompt"
                  >
                    <RoleIcon name={isCopied ? 'Check' : 'Copy'} size={14} />
                  </button>
                </div>
              </div>

              {/* ── BIG WINDOW PROMPT DISPLAY ────────────────── */}
              <div
                className="overflow-y-auto p-4 rounded-xl text-[13px] leading-relaxed select-text whitespace-pre-wrap transition-colors scrollbar-thin"
                style={{
                  background: isDark ? D.surface2 : '#F8FAFC',
                  border: `1px solid ${isDark ? D.borderSubtle : 'rgba(226, 232, 240, 0.9)'}`,
                  color: isDark ? D.textPrimary : '#1E293B',
                  minHeight: 180,
                  maxHeight: 380,
                  boxShadow: isDark
                    ? 'inset 0 1px 3px rgba(0, 0, 0, 0.4)'
                    : 'inset 0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                {version.text}
              </div>

              {/* ── Score Strip & 6 Dimension Breakdown ─────── */}
              {curAnalysis && (
                <div className="mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedVersionId(isExpanded ? null : version.id);
                    }}
                    className="w-full p-3 rounded-xl transition-all text-left flex items-center justify-between shadow-xs group cursor-pointer"
                    style={{
                      background: isDark ? D.surface2 : '#F8F9FE',
                      border: `1px solid ${isDark ? D.borderSubtle : '#ECE9FF'}`,
                    }}
                  >
                    <div>
                      <p
                        className="text-[10px] font-bold tracking-wider uppercase mb-0.5"
                        style={{ color: isDark ? '#A78BFA' : '#7C3AED' }}
                      >
                        SCORE
                      </p>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span
                          className="font-semibold text-sm"
                          style={{ color: isDark ? D.textMuted : '#94A3B8' }}
                        >
                          {curAnalysis.beforeScore}
                        </span>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1' }} className="text-xs">
                          →
                        </span>
                        <span className="font-bold text-base text-emerald-500">
                          {curAnalysis.afterScore}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {curAnalysis.afterScore > curAnalysis.beforeScore ? (
                        <span
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs"
                          style={{
                            background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                            color: isDark ? '#34D399' : '#059669',
                            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(167, 243, 208, 0.7)'}`,
                          }}
                        >
                          <RoleIcon name="TrendingUp" size={12} />
                          +{curAnalysis.afterScore - curAnalysis.beforeScore} pts
                        </span>
                      ) : (
                        <span
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                            color: isDark ? D.textMuted : '#64748B',
                            border: `1px solid ${isDark ? D.borderSubtle : '#E2E8F0'}`,
                          }}
                        >
                          Original
                        </span>
                      )}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                        style={{
                          background: isDark ? D.surfaceElevated : '#FFFFFF',
                          border: `1px solid ${isDark ? D.borderSubtle : '#E2E8F0'}`,
                          color: isDark ? D.textMuted : '#94A3B8',
                        }}
                      >
                        <RoleIcon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={13} />
                      </div>
                    </div>
                  </button>

                  {/* Expanded 6 Dimension Grid */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2.5 space-y-2">
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isDark ? D.textMuted : '#64748B',
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              margin: 0,
                            }}
                          >
                            6 Dimension Breakdown
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {curAnalysis.dimensions?.map((dim) => (
                              <div
                                key={dim.name}
                                style={{
                                  background: isDark ? D.surface2 : '#FFFFFF',
                                  border: `1.5px solid ${isDark ? D.borderSubtle : '#E8E4F8'}`,
                                  borderRadius: 14,
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: isDark ? D.textPrimary : '#1a1a2e',
                                  }}
                                >
                                  {dim.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace' }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 600, color: isDark ? D.textMuted : '#94A3B8' }}>
                                    {dim.before}
                                  </span>
                                  <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1' }}>→</span>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                                    {dim.after}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// VersionTimeline — Modern Big-Window Version History View
// Replaces cluttered timeline lines with spacious version cards & switcher
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import type { PromptVersion, PromptAnalysisData } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';
import { FormattedPromptViewer } from '../common/FormattedPromptViewer';
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
            className="text-[12px] font-semibold"
            style={{ color: isDark ? D.textPrimary : '#1E293B' }}
          >
            Drafts & Versions
          </h3>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
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
            className="text-[10.5px] font-medium"
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
                className="flex-1 min-w-[56px] py-1 px-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
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
            className="flex-1 min-w-[44px] py-1 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center cursor-pointer whitespace-nowrap"
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
              className="rounded-xl transition-all overflow-hidden flex flex-col"
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
              {/* 1. TOP: Version header with V1 badge & action button */}
              <div
                className="flex items-center justify-between gap-2 px-3 py-2 border-b"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }}
              >
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Distinct Solid V1/V2 Badge */}
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-md flex-shrink-0 tracking-wide text-white"
                    style={{
                      background: version.source === 'enhanced' ? '#7C3AED' : isDark ? '#334155' : '#64748B',
                      boxShadow: version.source === 'enhanced' ? '0 1px 4px rgba(124, 58, 237, 0.35)' : 'none',
                    }}
                  >
                    V{version.version}
                  </span>

                  {/* Distinct Outlined Source Tag with Micro Icon */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[9.5px] font-medium rounded-full capitalize flex-shrink-0"
                    style={{
                      backgroundColor:
                        version.source === 'enhanced'
                          ? isDark ? 'rgba(139, 92, 246, 0.12)' : '#EDE9FE'
                          : version.source === 'edited'
                          ? isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7'
                          : isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      color:
                        version.source === 'enhanced'
                          ? isDark ? '#C084FC' : '#7C3AED'
                          : version.source === 'edited'
                          ? isDark ? '#FBBF24' : '#D97706'
                          : isDark ? D.textMuted : '#64748B',
                      border: `1px solid ${
                        version.source === 'enhanced'
                          ? isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(167, 139, 250, 0.4)'
                          : version.source === 'edited'
                          ? isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                          : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)'
                      }`,
                    }}
                  >
                    {version.source === 'enhanced' && <RoleIcon name="Sparkles" size={10} strokeWidth={2.2} />}
                    {version.source === 'edited' && <RoleIcon name="Edit3" size={10} strokeWidth={2.2} />}
                    <span>{version.source}</span>
                  </span>
                </div>

                {/* Action Buttons: Solid Color (No Gradient) */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => handleAutoFill(e, version.text, version.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold text-white transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap hover:opacity-90"
                    style={{
                      background: '#7C3AED',
                    }}
                    title="Auto-fill in active AI Chat Input"
                  >
                    <RoleIcon name={isFilled ? 'Check' : 'ArrowUpRight'} size={11} strokeWidth={2.5} />
                    <span>{isFilled ? 'Filled!' : 'Fill Input'}</span>
                  </button>

                  <button
                    onClick={(e) => handleCopy(e, version.text, version.id)}
                    className="p-1 rounded-md transition-all cursor-pointer flex items-center justify-center flex-shrink-0 hover:opacity-80"
                    style={{
                      color: isCopied ? '#10B981' : isDark ? D.textMuted : '#64748B',
                      background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}`,
                    }}
                    title="Copy Prompt"
                  >
                    <RoleIcon name={isCopied ? 'Check' : 'Copy'} size={12} />
                  </button>
                </div>
              </div>

              {/* 2. MIDDLE: Enhanced prompt formatted with Section Badges, bullets & clean code blocks */}
              <div
                className="overflow-y-auto px-3.5 py-3 text-[11px] leading-relaxed select-text transition-colors scrollbar-thin font-sans"
                style={{
                  color: isDark ? '#E2E8F0' : '#1E293B',
                  minHeight: 140,
                  maxHeight: 340,
                }}
              >
                <FormattedPromptViewer content={version.text} fontSize={11} />
              </div>

              {/* 3. BOTTOM: Integrated Score Strip & Dimension Breakdown */}
              {curAnalysis && (
                <div
                  className="border-t transition-colors mt-auto"
                  style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedVersionId(isExpanded ? null : version.id);
                    }}
                    className="w-full px-3.5 py-2.5 transition-all text-left flex items-center justify-between group cursor-pointer"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-2.5 py-0.5 rounded-full"
                      style={{
                        background: isDark ? 'rgba(139, 92, 246, 0.12)' : '#EDE9FE',
                        border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(167, 139, 250, 0.4)'}`,
                      }}
                    >
                      <span
                        className="text-[9.5px] font-bold tracking-wider uppercase"
                        style={{ color: isDark ? '#C084FC' : '#7C3AED' }}
                      >
                        SCORE
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span style={{ color: isDark ? D.textMuted : '#94A3B8' }}>
                          {curAnalysis.beforeScore}
                        </span>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1' }}>
                          →
                        </span>
                        <span className="font-bold text-emerald-500">
                          {curAnalysis.afterScore}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {curAnalysis.afterScore > curAnalysis.beforeScore ? (
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                          style={{
                            background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                            color: isDark ? '#34D399' : '#059669',
                            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(167, 243, 208, 0.7)'}`,
                          }}
                        >
                          <RoleIcon name="TrendingUp" size={11} />
                          +{curAnalysis.afterScore - curAnalysis.beforeScore} pts
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
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
                        className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? D.textMuted : '#94A3B8',
                        }}
                      >
                        <RoleIcon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={11} />
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
                        className="overflow-hidden px-3.5 pb-3 border-t"
                        style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' }}
                      >
                        <div className="pt-2.5 space-y-2">
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isDark ? D.textMuted : '#64748B',
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              margin: 0,
                            }}
                          >
                            6 Dimension Breakdown
                          </p>

                          <div className="grid grid-cols-2 gap-1.5">
                            {curAnalysis.dimensions?.map((dim) => (
                              <div
                                key={dim.name}
                                style={{
                                  background: isDark ? D.surface2 : '#F8FAFC',
                                  border: `1px solid ${isDark ? D.borderSubtle : '#E2E8F0'}`,
                                  borderRadius: 10,
                                  padding: '7px 10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: isDark ? D.textPrimary : '#1e293b',
                                  }}
                                >
                                  {dim.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                                  <span style={{ fontSize: 10.5, fontWeight: 500, color: isDark ? D.textMuted : '#94A3B8' }}>
                                    {dim.before}
                                  </span>
                                  <span style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1' }}>→</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
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

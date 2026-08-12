// ──────────────────────────────────────────────────────────────
// VersionTimeline — Prompt version history timeline
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import type { PromptVersion, PromptAnalysisData } from '@/types/prompt';
import { RoleIcon } from '../common/RoleIcon';

interface VersionTimelineProps {
  promptId: string;
  analysisData?: PromptAnalysisData;
}

// Directly inject prompt into the active ChatGPT / Claude / Gemini tab
async function fillPromptInTab(text: string): Promise<boolean> {
  try {
    // Query all tabs and find an AI chat page
    const allTabs = await chrome.tabs.query({});
    const AI_HOSTS = [
      'chatgpt.com', 'chat.openai.com', 'claude.ai',
      'gemini.google.com', 'perplexity.ai', 'grok.com',
      'deepseek.com', 'copilot.microsoft.com',
    ];

    // Priority 1: active http tab in a normal window
    let target = allTabs.find(
      (t) => t.active && t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')) && !t.url.startsWith('chrome-extension://')
    );

    // Priority 2: any open AI host tab
    if (!target) {
      target = allTabs.find(
        (t) => t.url && AI_HOSTS.some((h) => t.url!.includes(h))
      );
    }

    // Priority 3: any http tab
    if (!target) {
      target = allTabs.find(
        (t) => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://'))
      );
    }

    if (!target?.id) return false;

    // First try to inject directly via chrome.scripting (most reliable)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: target.id },
        func: (promptText: string) => {
          const selectors = [
            '#prompt-textarea',
            'div[contenteditable="true"][data-placeholder]',
            'div[contenteditable="true"][aria-label]',
            'div[contenteditable="true"]',
            'textarea',
            'div[role="textbox"]',
          ];

          let input: HTMLElement | null = null;
          for (const sel of selectors) {
            const el = document.querySelector<HTMLElement>(sel);
            if (el && el.isConnected) {
              input = el;
              break;
            }
          }
          if (!input) return false;

          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });

          if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
            if (nativeSetter) nativeSetter.call(input, promptText);
            else input.value = promptText;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }

          if (input.getAttribute('contenteditable') === 'true' || input.isContentEditable) {
            input.innerHTML = '';
            const lines = promptText.split('\n');
            lines.forEach((line) => {
              const p = document.createElement('p');
              p.textContent = line || '\u200B';
              (input as HTMLElement).appendChild(p);
            });

            try {
              const sel = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(input);
              sel?.removeAllRanges();
              sel?.addRange(range);
              document.execCommand('insertText', false, promptText);
            } catch (_) { /* ignore */ }

            input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: promptText }));
            input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: promptText }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Process' }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Process' }));
            return true;
          }
          return false;
        },
        args: [text],
      });
      return true;
    } catch (scriptErr) {
      console.warn('[AURE] scripting.executeScript failed, falling back to sendMessage:', scriptErr);
    }

    // Fallback: send message to content script
    try {
      await chrome.tabs.sendMessage(target.id, { type: 'FILL_PROMPT', payload: { text } });
      return true;
    } catch (msgErr) {
      console.warn('[AURE] tabs.sendMessage failed:', msgErr);
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

  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const result = await sendMessage('GET_VERSIONS', { promptId });
        setVersions(result.versions);
      } catch (error) {
        console.error('Failed to fetch versions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
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
      // Always copy to clipboard first as safe fallback
      await navigator.clipboard.writeText(text).catch(() => {});

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

  // Build per-version analysis:
  // V1 (user/original) → show "before" dimension scores
  // V2+ (enhanced/edited) → show "after" dimension scores
  const getDimensionScoresForVersion = (version: PromptVersion, versionIndex: number) => {
    if (!analysisData?.dimensions?.length) return null;

    if (versionIndex === 0 || version.source === 'user') {
      // Show before scores for original version
      return {
        totalScore: analysisData.beforeScore,
        label: 'Original Score',
        dims: analysisData.dimensions.map((d) => ({
          name: d.name,
          score: d.before,
          color: '#8E8EA0',
        })),
      };
    } else {
      // Show after scores for enhanced versions
      return {
        totalScore: analysisData.afterScore,
        label: 'Enhanced Score',
        dims: analysisData.dimensions.map((d) => ({
          name: d.name,
          score: d.after,
          color: '#10b981',
        })),
      };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 bg-white/60 rounded-2xl border border-slate-100/80 my-2">
      <h3 className="text-[12px] font-bold text-slate-800 mb-3 flex items-center justify-between">
        <span>Version History</span>
        <span className="text-[10px] font-medium text-slate-400">{versions.length} versions</span>
      </h3>
      <div className="relative pl-1">
        {/* Timeline vertical line */}
        <div className="absolute left-3.5 top-2 bottom-4 w-0.5 bg-slate-200/80 rounded-full" />

        <div className="space-y-4">
          {versions.map((version, i) => {
            const isExpanded = expandedVersionId === version.id;
            const isFilled = filledId === version.id;
            const isCopied = copiedId === version.id;
            const versionAnalysis = getDimensionScoresForVersion(version, i);

            return (
              <motion.div
                key={version.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative pl-8"
              >
                {/* Timeline dot */}
                <div
                  className={`
                    absolute left-2 top-2.5 w-3.5 h-3.5 rounded-full border-2 z-10 flex items-center justify-center
                    ${version.source === 'enhanced'
                      ? 'bg-primary-500 border-white shadow-xs'
                      : version.source === 'edited'
                        ? 'bg-amber-500 border-white shadow-xs'
                        : 'bg-slate-300 border-white'
                    }
                  `}
                />

                {/* Version Header */}
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      V{version.version}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize
                        ${version.source === 'enhanced'
                          ? 'bg-primary-50 text-primary-600 border border-primary-200/60'
                          : version.source === 'edited'
                            ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
                            : 'bg-slate-100 text-slate-600'
                        }
                      `}
                    >
                      {version.source}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(version.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleAutoFill(e, version.text, version.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 transition-all shadow-xs"
                      title="Auto-fill in AI Chat Input"
                    >
                      <RoleIcon name={isFilled ? 'Check' : 'ArrowUpRight'} size={12} strokeWidth={2.5} />
                      <span>{isFilled ? 'Filled!' : 'Fill Input'}</span>
                    </button>

                    <button
                      onClick={(e) => handleCopy(e, version.text, version.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-100 transition-all"
                      title="Copy Prompt"
                    >
                      <RoleIcon name={isCopied ? 'Check' : 'Copy'} size={13} />
                    </button>
                  </div>
                </div>

                {/* Fixed Height Scrollable Prompt Box */}
                <div className="max-h-40 overflow-y-auto pr-2 p-3 rounded-xl bg-slate-50/90 border border-slate-200/70 text-xs text-slate-700 leading-relaxed font-sans shadow-2xs whitespace-pre-wrap select-text scrollbar-thin">
                  {version.text}
                </div>

                {/* Toggle 6 Dimension Scores for this version */}
                {versionAnalysis && (
                  <div className="mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedVersionId(isExpanded ? null : version.id);
                      }}
                      className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 hover:text-primary-600 transition-colors px-1 py-0.5"
                    >
                      <RoleIcon name="BarChart3" size={11} />
                      <span>6 Dimension Score</span>
                      <span
                        className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          version.source === 'user'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                        }`}
                      >
                        {versionAnalysis.totalScore}
                      </span>
                      <RoleIcon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} size={11} />
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-3 bg-[#F8F9FE] rounded-xl border border-[#ECE9FF]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {versionAnalysis.label}
                              </span>
                              <span
                                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                                  version.source === 'user'
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200/50'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                                }`}
                              >
                                Score: {versionAnalysis.totalScore}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {versionAnalysis.dims.map((dim) => (
                                <div
                                  key={dim.name}
                                  className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 flex items-center justify-between"
                                >
                                  <span className="text-[11px] font-semibold text-[#1a1a2e]">{dim.name}</span>
                                  <span
                                    className="text-[11px] font-bold font-mono"
                                    style={{ color: dim.color }}
                                  >
                                    {dim.score}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Before → After comparison only on enhanced versions */}
                            {version.source !== 'user' && analysisData?.dimensions && (
                              <div className="mt-2 pt-2 border-t border-slate-200/60">
                                <p className="text-[9.5px] text-slate-400 font-medium uppercase tracking-wider mb-1.5">Before → After</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {analysisData.dimensions.map((dim) => (
                                    <div key={dim.name} className="flex items-center justify-between bg-white rounded-lg px-2 py-1 border border-slate-100">
                                      <span className="text-[10px] text-slate-600 font-medium">{dim.name}</span>
                                      <div className="flex items-center gap-1 text-[10px] font-mono">
                                        <span className="text-slate-400">{dim.before}</span>
                                        <span className="text-slate-300">→</span>
                                        <span className="text-emerald-500 font-bold">{dim.after}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
    </div>
  );
};

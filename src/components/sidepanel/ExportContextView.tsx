// ──────────────────────────────────────────────────────────────
// ExportContextView — Simplified Tab View for AI Prompt Export
// Formats clean prompts for seamless AI ingestion (ChatGPT, Claude, Cursor)
// ──────────────────────────────────────────────────────────────

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  Download,
  Search,
  Layers,
  RefreshCw,
  FileText,
  Eye,
  X,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { sendMessage } from '@/lib/messaging';
import {
  MultiChatExportItem,
  ExportVersion,
  ExportFormat,
  buildMultiChatHandoff,
  stripVariablesSection,
  downloadTextFile,
  copyTextToClipboard,
} from '@/lib/export-context';

interface ExportContextViewProps {
  initialSelectedIds?: string[];
  onSignIn?: () => void;
}

export const ExportContextView: React.FC<ExportContextViewProps> = ({
  initialSelectedIds,
  onSignIn,
}) => {
  const { isDark, D } = useTheme();
  const { isAuthenticated, loadAuth } = useAuthStore();

  const [prompts, setPrompts] = useState<MultiChatExportItem[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

  // Selected prompt IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(initialSelectedIds || []);
  });

  // Output format: .txt or .md (Clean Prompts is always used)
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Enriched versions map fetched from backend DB
  const [enrichedVersionsMap, setEnrichedVersionsMap] = useState<Record<string, ExportVersion[]>>({});

  // Load prompts from history
  const fetchPrompts = useCallback(async () => {
    if (!isAuthenticated) {
      setPrompts([]);
      setIsLoadingPrompts(false);
      return;
    }
    setIsLoadingPrompts(true);
    try {
      const result = await sendMessage('GET_HISTORY', {
        timeRange: 'all',
        limit: 50,
      });

      const rawPrompts = result?.prompts || [];
      const mapped: MultiChatExportItem[] = rawPrompts.map((p: any) => ({
        id: p.id,
        title: p.title || p.originalText?.slice(0, 50) || 'Untitled Prompt',
        originalPrompt: p.originalText || '',
        mode: p.mode,
        category: p.category,
        targetModel: p.aiModel,
        score: p.analysisData?.afterScore ?? p.successScore,
        createdAt: p.createdAt,
        optimizedPrompt: p.enhancedText,
        versions: p.enhancedText
          ? [
              {
                versionNumber: p.versionNumber || 1,
                optimizedPrompt: p.enhancedText,
                overallScore: p.analysisData?.afterScore ?? p.successScore,
              },
            ]
          : undefined,
      }));

      setPrompts(mapped);

      // Default selection to initialSelectedIds or first 3
      setSelectedIds((prev) => {
        if (initialSelectedIds && initialSelectedIds.length > 0) {
          return new Set(initialSelectedIds);
        }
        if (prev.size > 0) return prev;
        return new Set(mapped.slice(0, 3).map((p) => p.id));
      });
    } catch (err) {
      console.error('[AURE] Failed to load prompts for Context Export:', err);
    } finally {
      setIsLoadingPrompts(false);
    }
  }, [isAuthenticated, initialSelectedIds]);

  useEffect(() => {
    loadAuth();
    fetchPrompts();
  }, [loadAuth, fetchPrompts]);

  // Filtered prompts
  const filteredPrompts = useMemo(() => {
    if (!searchFilter.trim()) return prompts;
    const q = searchFilter.toLowerCase();
    return prompts.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.originalPrompt || '').toLowerCase().includes(q) ||
        (p.mode || '').toLowerCase().includes(q)
    );
  }, [prompts, searchFilter]);

  // Selected items to export
  const selectedItems = useMemo(() => {
    return prompts.filter((p) => selectedIds.has(p.id));
  }, [prompts, selectedIds]);

  // Fetch full version history directly from backend for all prompts in view
  useEffect(() => {
    const idsToFetch = prompts
      .map((i) => i.id)
      .filter((id) => id && !enrichedVersionsMap[id]);

    if (idsToFetch.length === 0) return;

    let isMounted = true;

    Promise.allSettled(
      idsToFetch.map(async (id) => {
        try {
          const res = await sendMessage('GET_VERSIONS', { promptId: id });
          const rawList = res?.versions ?? [];
          if (rawList.length > 0) {
            const versions: ExportVersion[] = rawList.map((v: any, idx: number) => ({
              versionNumber: v.version ?? v.version_number ?? idx + 1,
              optimizedPrompt: stripVariablesSection(v.text ?? v.content ?? ''),
              tweakNote: (v.metadata?.change_summary as string) || v.tweakNote || undefined,
              overallScore: v.analysisData?.afterScore ?? v.overallScore ?? undefined,
              timestamp: v.createdAt ?? v.created_at,
            }));
            return { id, versions };
          }
        } catch (err) {
          console.warn(`Could not fetch versions for prompt ${id}:`, err);
        }
        return null;
      })
    ).then((results) => {
      if (!isMounted) return;
      const newEntries: Record<string, ExportVersion[]> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          newEntries[r.value.id] = r.value.versions;
        }
      });
      if (Object.keys(newEntries).length > 0) {
        setEnrichedVersionsMap((prev) => ({ ...prev, ...newEntries }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [prompts, enrichedVersionsMap]);

  // Enrich selected items with clean latest prompt (Option 1: Clean Prompts)
  const enrichedSelectedItems = useMemo(() => {
    return selectedItems.map((item) => {
      const fetched = enrichedVersionsMap[item.id];
      const versionsToUse =
        fetched && fetched.length > 0
          ? fetched
          : item.versions && item.versions.length > 0
          ? item.versions
          : item.optimizedPrompt
          ? [{ versionNumber: 1, optimizedPrompt: item.optimizedPrompt, overallScore: item.score }]
          : [];

      const sorted = [...versionsToUse]
        .map((v) => ({
          ...v,
          optimizedPrompt: stripVariablesSection(v.optimizedPrompt || ''),
        }))
        .sort((a, b) => a.versionNumber - b.versionNumber);

      const latest = sorted[sorted.length - 1];
      return {
        ...item,
        optimizedPrompt: latest?.optimizedPrompt || stripVariablesSection(item.optimizedPrompt || ''),
        score: latest?.overallScore ?? item.score,
        versions: sorted,
      };
    });
  }, [selectedItems, enrichedVersionsMap]);

  // Generate exported text (always Clean Prompts / Option 1)
  const exportedText = useMemo(() => {
    if (enrichedSelectedItems.length === 0) return '';
    return buildMultiChatHandoff(enrichedSelectedItems, format);
  }, [enrichedSelectedItems, format]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(prompts.map((p) => p.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  // Copy action
  const handleCopy = async () => {
    if (!exportedText) return;
    const ok = await copyTextToClipboard(exportedText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Download action with specific format
  const handleDownloadFormat = (fmt: ExportFormat) => {
    setFormat(fmt);
    const content = buildMultiChatHandoff(enrichedSelectedItems, fmt);
    if (!content) return;
    const count = enrichedSelectedItems.length;
    const ext = fmt === 'md' ? 'md' : 'txt';
    const mime = fmt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const filename = `aure_prompts_export_${count}_items.${ext}`;
    downloadTextFile(filename, content, mime);
  };

  if (!isAuthenticated) {
    return (
      <div className="p-5 text-center py-16 flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
            color: isDark ? '#C084FC' : '#7C3AED',
          }}
        >
          <Layers size={22} />
        </div>
        <div>
          <p className="text-[14px] font-bold" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
            Sign In Required
          </p>
          <p className="text-[12px] mt-1 max-w-[240px]" style={{ color: isDark ? D.textSecondary : '#8E8EA0' }}>
            Sign in to access your saved prompts and export them to ChatGPT, Claude, or Cursor.
          </p>
        </div>
        <button
          onClick={() => onSignIn?.()}
          className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: '#7C3AED' }}
        >
          Sign In to AURE
        </button>
      </div>
    );
  }

  return (
    <div className="p-3.5 space-y-2.5 max-w-full">
      {/* ── Choose Prompts Header ───────────────────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isDark ? D.textMuted : '#64748B' }}>
          Choose Prompts ({selectedIds.size} of {prompts.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-[11.5px] font-semibold text-purple-500 hover:underline cursor-pointer"
          >
            Select All
          </button>
          <span className="opacity-30 text-[11px]">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-[11.5px] font-semibold opacity-70 hover:opacity-100 cursor-pointer"
            style={{ color: isDark ? D.textMuted : '#64748B' }}
          >
            Clear
          </button>
          <span className="opacity-30 text-[11px]">|</span>
          <button
            type="button"
            onClick={fetchPrompts}
            title="Refresh prompts"
            className="p-0.5 rounded text-xs cursor-pointer transition-all opacity-60 hover:opacity-100"
            style={{ color: isDark ? D.textSecondary : '#64748B' }}
          >
            <RefreshCw size={11.5} className={isLoadingPrompts ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: isDark ? D.textMuted : '#8E8EA0',
          }}
        />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Search saved prompts..."
          className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none transition-all"
          style={{
            border: `1px solid ${isDark ? D.border : '#E2E8F0'}`,
            background: isDark ? D.surface : '#FFFFFF',
            color: isDark ? D.textPrimary : '#1a1a2e',
          }}
        />
      </div>

      {/* Prompt items list (Direct chats list, generous height) */}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5 scrollbar-thin">
        {isLoadingPrompts ? (
          <div className="py-8 text-center text-xs opacity-60">Loading prompts...</div>
        ) : filteredPrompts.length === 0 ? (
          <div className="py-8 text-center text-xs opacity-60">No prompts found</div>
        ) : (
          filteredPrompts.map((p) => {
            const isChecked = selectedIds.has(p.id);
            const vers = enrichedVersionsMap[p.id] || p.versions || [];
            const count = vers.length > 0 ? vers.length : 1;
            const versionLabel = count === 1 ? '1 version' : `${count} versions`;

            return (
              <div
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all select-none hover:opacity-95"
                style={{
                  background: isChecked
                    ? (isDark ? 'rgba(139, 92, 246, 0.16)' : '#F5F3FF')
                    : (isDark ? D.surface : '#FFFFFF'),
                  border: `1px solid ${isChecked ? (isDark ? '#A855F7' : '#7C3AED') : (isDark ? D.border : '#ECE9FF')}`,
                  boxShadow: isChecked
                    ? '0 2px 8px rgba(124, 58, 237, 0.12)'
                    : (isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.02)'),
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // handled by parent div click
                  className="w-4 h-4 rounded cursor-pointer shrink-0"
                  style={{ accentColor: '#8B5CF6' }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{ color: isChecked ? (isDark ? '#FFFFFF' : '#1E1B4B') : (isDark ? D.textPrimary : '#334155') }}
                  >
                    {p.title}
                  </p>
                  <p
                    className="text-[11px] truncate opacity-70 mt-0.5"
                    style={{ color: isDark ? D.textMuted : '#64748B' }}
                  >
                    {p.originalPrompt}
                  </p>
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE',
                    color: isDark ? '#C084FC' : '#7C3AED',
                  }}
                >
                  {versionLabel}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ── Preview & Quick Action Bar directly below the chats ── */}
      <div className="pt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPreviewOpen(true)}
          disabled={selectedIds.size === 0}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 disabled:opacity-50 hover:opacity-90"
          style={{ background: '#7C3AED' }}
        >
          <Eye size={13} strokeWidth={2.2} />
          <span>Preview Context ({selectedIds.size})</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          disabled={selectedIds.size === 0 || !exportedText}
          title="Quick Copy to Clipboard"
          className="py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
          style={{
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
            background: isDark ? D.surface : '#FFFFFF',
            color: copied ? '#10B981' : (isDark ? D.textPrimary : '#334155'),
          }}
        >
          {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* ── Layer / Modal Overlay for Preview (Centered in Middle of Screen with Increased Height) ── */}
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[390px] h-[85vh] max-h-[720px] rounded-2xl flex flex-col p-4 space-y-2.5 shadow-2xl overflow-hidden"
              style={{
                background: isDark ? '#141320' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(124, 58, 237, 0.16)'}`,
                boxShadow: isDark
                  ? '0 16px 48px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)'
                  : '0 16px 40px rgba(124, 58, 237, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Overlay Header */}
              <div
                className="flex items-center justify-between border-b pb-2"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#EDE9FE',
                      color: isDark ? '#C084FC' : '#7C3AED',
                    }}
                  >
                    <Eye size={13} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                      Context Preview
                    </h3>
                    <p className="text-[9.5px]" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
                      {selectedIds.size} {selectedIds.size === 1 ? 'prompt' : 'prompts'} ready for export
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    color: isDark ? D.textSecondary : '#64748B',
                  }}
                  title="Close preview"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Monospace Preview Box (Expands to fill available modal height) */}
              <div
                className="p-3 rounded-xl overflow-y-auto flex-1 min-h-0 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words scrollbar-thin select-text"
                style={{
                  background: isDark ? '#0A0914' : '#F8FAFC',
                  color: isDark ? '#E2E8F0' : '#1E293B',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'}`,
                }}
              >
                {exportedText || '// Select at least 1 prompt to preview.'}
              </div>

              {/* Copy Prompts Button */}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!exportedText}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50 hover:opacity-90"
                style={{
                  background: copied ? '#10B981' : '#7C3AED',
                }}
              >
                {copied ? (
                  <>
                    <Check size={14} strokeWidth={2.5} />
                    <span>Copied! Ready to paste</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy to Clipboard</span>
                  </>
                )}
              </button>

              {/* Two Options Below: .TXT File and .MD File */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleDownloadFormat('txt')}
                  disabled={!exportedText}
                  className="py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  style={{
                    border: `1px solid ${format === 'txt' ? '#8B5CF6' : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0')}`,
                    background: format === 'txt'
                      ? (isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF')
                      : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC'),
                    color: format === 'txt' ? (isDark ? '#C084FC' : '#7C3AED') : (isDark ? D.textPrimary : '#334155'),
                  }}
                >
                  <FileText size={12} />
                  <span>.TXT File</span>
                  <Download size={11} className="opacity-70 ml-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFormat('md')}
                  disabled={!exportedText}
                  className="py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  style={{
                    border: `1px solid ${format === 'md' ? '#8B5CF6' : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0')}`,
                    background: format === 'md'
                      ? (isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF')
                      : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC'),
                    color: format === 'md' ? (isDark ? '#C084FC' : '#7C3AED') : (isDark ? D.textPrimary : '#334155'),
                  }}
                >
                  <FileText size={12} />
                  <span>.MD File</span>
                  <Download size={11} className="opacity-70 ml-0.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

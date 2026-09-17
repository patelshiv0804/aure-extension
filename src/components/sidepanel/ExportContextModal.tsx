// ──────────────────────────────────────────────────────────────
// ExportContextModal — Multi-Prompt / Multi-Chat AI Context Export Modal
// Formats multiple prompts for ChatGPT, Claude, Gemini, Cursor handoff
// Ported & enhanced from Prompt_Enhancer-FE MultiChatExportModal
// ──────────────────────────────────────────────────────────────

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  Download,
  Sparkles,
  FileText,
  Search,
  Layers,
  Bot,
  Eye,
  HelpCircle,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { sendMessage } from '@/lib/messaging';
import {
  MultiChatExportItem,
  ExportVersion,
  ExportMode,
  ExportFormat,
  buildMultiChatHandoff,
  buildMultiChatTranscript,
  stripVariablesSection,
  downloadTextFile,
  copyTextToClipboard,
} from '@/lib/export-context';

export interface ExportContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePrompts: MultiChatExportItem[];
  initialSelectedIds?: string[];
}

export const ExportContextModal: React.FC<ExportContextModalProps> = ({
  isOpen,
  onClose,
  availablePrompts,
  initialSelectedIds,
}) => {
  const { isDark, D } = useTheme();

  // Selected prompt IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      return new Set(initialSelectedIds);
    }
    return new Set(availablePrompts.map((p) => p.id));
  });

  // Export settings
  const [mode, setMode] = useState<ExportMode>('smart');
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'configure' | 'preview'>('configure');

  // Enriched versions map fetched from backend DB
  const [enrichedVersionsMap, setEnrichedVersionsMap] = useState<Record<string, ExportVersion[]>>({});
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Sync initialSelectedIds when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedIds(new Set(initialSelectedIds));
      } else if (availablePrompts.length > 0) {
        setSelectedIds(new Set(availablePrompts.map((p) => p.id)));
      }
      setCopied(false);
      setActiveMobileTab('configure');
    }
  }, [isOpen, initialSelectedIds, availablePrompts]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered available prompts in selector
  const filteredPrompts = useMemo(() => {
    if (!searchFilter.trim()) return availablePrompts;
    const q = searchFilter.toLowerCase();
    return availablePrompts.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.originalPrompt || '').toLowerCase().includes(q) ||
        (p.mode || '').toLowerCase().includes(q)
    );
  }, [availablePrompts, searchFilter]);

  // Selected items to export
  const selectedItems = useMemo(() => {
    return availablePrompts.filter((p) => selectedIds.has(p.id));
  }, [availablePrompts, selectedIds]);

  // Fetch full version history directly from backend for all prompts in modal
  useEffect(() => {
    if (!isOpen) return;

    const idsToFetch = availablePrompts
      .map((i) => i.id)
      .filter((id) => id && !enrichedVersionsMap[id]);

    if (idsToFetch.length === 0) return;

    let isMounted = true;
    setLoadingVersions(true);

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
              dimensions: v.analysisData?.dimensions
                ? v.analysisData.dimensions.map((d: any) => ({
                    label: d.name ?? d.label ?? '',
                    score: d.after ?? d.score ?? 0,
                    desc: d.desc ?? '',
                  }))
                : undefined,
              timestamp: v.createdAt ?? v.created_at,
            }));
            return { id, versions };
          }
        } catch (err) {
          console.warn(`Could not fetch versions for prompt ${id}:`, err);
        }
        return null;
      })
    )
      .then((results) => {
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
      })
      .finally(() => {
        if (isMounted) setLoadingVersions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, availablePrompts, enrichedVersionsMap]);

  // Enrich selected items with full version history
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

  // Generate exported text
  const exportedText = useMemo(() => {
    if (enrichedSelectedItems.length === 0) return '';
    return mode === 'smart'
      ? buildMultiChatHandoff(enrichedSelectedItems, format)
      : buildMultiChatTranscript(enrichedSelectedItems, format);
  }, [enrichedSelectedItems, mode, format]);

  // Word & token estimates
  const stats = useMemo(() => {
    if (!exportedText) return { words: 0, tokens: 0 };
    const words = exportedText.trim().split(/\s+/).filter(Boolean).length;
    const tokens = Math.round(words * 1.33);
    return { words, tokens };
  }, [exportedText]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // Keep at least one
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(availablePrompts.map((p) => p.id)));
  };

  const clearExceptFirst = () => {
    if (availablePrompts.length > 0) {
      setSelectedIds(new Set([availablePrompts[0].id]));
    }
  };

  // Actions
  const handleCopy = async () => {
    if (!exportedText) return;
    const ok = await copyTextToClipboard(exportedText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    if (!exportedText) return;
    const count = enrichedSelectedItems.length;
    const ext = format === 'md' ? 'md' : 'txt';
    const mime = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const filename = `aure_multi_context_${count}_projects.${ext}`;
    downloadTextFile(filename, exportedText, mime);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Export Contexts"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 860,
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? '#11101D' : '#FFFFFF',
            borderRadius: 20,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(124, 58, 237, 0.20)'}`,
            boxShadow: isDark
              ? '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(139, 92, 246, 0.18)'
              : '0 24px 60px rgba(109, 40, 217, 0.20), 0 4px 16px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'}`,
              background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#FAFAFD',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'rgba(139, 92, 246, 0.20)' : 'rgba(124, 58, 237, 0.10)',
                  color: isDark ? '#C084FC' : '#7C3AED',
                  border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.30)' : 'rgba(124, 58, 237, 0.20)'}`,
                }}
              >
                <Layers size={18} strokeWidth={2} />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: isDark ? D.textPrimary : '#1a1a2e',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Export Contexts
                </h2>
                <p
                  style={{
                    fontSize: 12,
                    color: isDark ? D.textSecondary : '#64748B',
                    margin: 0,
                  }}
                >
                  Bundle prompt projects for seamless ingestion by ChatGPT, Claude, or Cursor.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close export dialog"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? D.textSecondary : '#64748B',
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Segmented view switch for narrower panels */}
          <div
            className="md:hidden"
            style={{
              display: 'flex',
              padding: '8px 16px',
              gap: 8,
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              background: isDark ? '#0D0C17' : '#F8FAFC',
            }}
          >
            <button
              onClick={() => setActiveMobileTab('configure')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeMobileTab === 'configure'
                  ? (isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE')
                  : 'transparent',
                color: activeMobileTab === 'configure'
                  ? (isDark ? '#C084FC' : '#7C3AED')
                  : (isDark ? D.textMuted : '#64748B'),
              }}
            >
              Settings & Selection ({selectedIds.size})
            </button>
            <button
              onClick={() => setActiveMobileTab('preview')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeMobileTab === 'preview'
                  ? (isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE')
                  : 'transparent',
                color: activeMobileTab === 'preview'
                  ? (isDark ? '#C084FC' : '#7C3AED')
                  : (isDark ? D.textMuted : '#64748B'),
              }}
            >
              Live Preview & Export
            </button>
          </div>

          {/* Main Body */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Left Panel: Options & Prompt Selector */}
            <div
              className={`flex-col md:flex ${activeMobileTab === 'configure' ? 'flex' : 'hidden md:flex'}`}
              style={{
                width: '100%',
                maxWidth: 320,
                flexShrink: 0,
                borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'}`,
                padding: 16,
                gap: 14,
                background: isDark ? '#0D0C17' : '#FCFCFE',
                overflowY: 'auto',
              }}
            >
              {/* Mode selection */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: isDark ? D.textMuted : '#64748B',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Export Mode
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => setMode('smart')}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: mode === 'smart'
                        ? `1.5px solid ${isDark ? '#A855F7' : '#7C3AED'}`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.12)'}`,
                      background: mode === 'smart'
                        ? (isDark ? 'rgba(139, 92, 246, 0.16)' : 'rgba(124, 58, 237, 0.06)')
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 160ms ease',
                    }}
                  >
                    <Sparkles size={15} style={{ color: isDark ? '#C084FC' : '#7C3AED', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? D.textPrimary : '#1a1a2e' }}>
                        AI Context
                      </div>
                      <div style={{ fontSize: 10.5, color: isDark ? D.textSecondary : '#64748B', marginTop: 1, lineHeight: 1.3 }}>
                        Active prompts, rules & continuation instructions for ChatGPT, Claude, etc.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('transcript')}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: mode === 'transcript'
                        ? `1.5px solid ${isDark ? '#A855F7' : '#7C3AED'}`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.12)'}`,
                      background: mode === 'transcript'
                        ? (isDark ? 'rgba(139, 92, 246, 0.16)' : 'rgba(124, 58, 237, 0.06)')
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 160ms ease',
                    }}
                  >
                    <FileText size={15} style={{ color: isDark ? '#C084FC' : '#7C3AED', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? D.textPrimary : '#1a1a2e' }}>
                        Full History
                      </div>
                      <div style={{ fontSize: 10.5, color: isDark ? D.textSecondary : '#64748B', marginTop: 1, lineHeight: 1.3 }}>
                        Complete log of all prompt versions, tweak notes, and scores.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Format toggle: TXT vs MD */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: isDark ? D.textMuted : '#64748B',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Output Format
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['txt', 'md'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: format === fmt
                          ? `1.5px solid ${isDark ? '#A855F7' : '#7C3AED'}`
                          : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.12)'}`,
                        background: format === fmt
                          ? (isDark ? 'rgba(139,92,246,0.22)' : 'rgba(124,58,237,0.08)')
                          : 'transparent',
                        color: format === fmt
                          ? (isDark ? '#C084FC' : '#7C3AED')
                          : (isDark ? D.textSecondary : '#64748B'),
                        transition: 'all 160ms ease',
                        textTransform: 'uppercase',
                      }}
                    >
                      .{fmt} {fmt === 'txt' ? '(Text)' : '(Markdown)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Prompts List */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: isDark ? D.textMuted : '#64748B',
                    }}
                  >
                    Prompts ({selectedIds.size}/{availablePrompts.length})
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={selectAll}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: isDark ? '#C084FC' : '#7C3AED',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Select All
                    </button>
                    <span style={{ opacity: 0.3, fontSize: 11 }}>|</span>
                    <button
                      onClick={clearExceptFirst}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: isDark ? D.textMuted : '#64748B',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search in modal */}
                {availablePrompts.length > 3 && (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <Search
                      size={12}
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: isDark ? D.textMuted : '#8E8EA0',
                      }}
                    />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filter prompts..."
                      style={{
                        width: '100%',
                        padding: '5px 8px 5px 24px',
                        fontSize: 11.5,
                        borderRadius: 6,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(124,58,237,0.14)'}`,
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                        color: isDark ? D.textPrimary : '#1a1a2e',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                {/* Prompts list checkboxes */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    overflowY: 'auto',
                    maxHeight: 180,
                    paddingRight: 2,
                  }}
                >
                  {filteredPrompts.map((p) => {
                    const isChecked = selectedIds.has(p.id);
                    const title = p.title || p.originalPrompt.slice(0, 45) || 'Untitled Prompt';
                    const vers = enrichedVersionsMap[p.id] || p.versions || [];
                    const count = vers.length > 0 ? vers.length : 1;

                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '5px 7px',
                          borderRadius: 7,
                          fontSize: 11.5,
                          cursor: 'pointer',
                          background: isChecked
                            ? isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(124, 58, 237, 0.05)'
                            : 'transparent',
                          border: `1px solid ${isChecked ? (isDark ? 'rgba(167,139,250,0.3)' : 'rgba(124,58,237,0.18)') : 'transparent'}`,
                          transition: 'all 120ms ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(p.id)}
                          style={{ accentColor: '#8B5CF6', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: isChecked ? (isDark ? '#FFFFFF' : '#1a1a2e') : (isDark ? D.textSecondary : '#64748B'),
                            fontWeight: isChecked ? 600 : 400,
                          }}
                        >
                          {title}
                        </span>
                        <span
                          style={{
                            fontSize: 9.5,
                            padding: '1px 4.5px',
                            borderRadius: 4,
                            background: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(124,58,237,0.10)',
                            color: isDark ? '#C084FC' : '#7C3AED',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {count}v
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel: Live Preview & Actions */}
            <div
              className={`flex-col flex-1 min-w-0 ${activeMobileTab === 'preview' ? 'flex' : 'hidden md:flex'}`}
              style={{
                background: isDark ? '#11101D' : '#FFFFFF',
              }}
            >
              {/* Preview Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
                  background: isDark ? 'rgba(255, 255, 255, 0.01)' : '#FAF9FD',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    color: isDark ? D.textSecondary : '#64748B',
                  }}
                >
                  <Eye size={13} />
                  <span style={{ fontWeight: 600 }}>Live Export Preview</span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span>{selectedItems.length} {selectedItems.length === 1 ? 'prompt' : 'prompts'}</span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span>~{stats.words.toLocaleString()} words (~{stats.tokens.toLocaleString()} tokens)</span>
                </div>

                <div>
                  {loadingVersions ? (
                    <span
                      style={{
                        fontSize: 10.5,
                        color: isDark ? '#C084FC' : '#7C3AED',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <Loader2 size={11} className="animate-spin" /> Fetching version history...
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 10.5,
                        color: isDark ? '#10B981' : '#059669',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <Bot size={11} /> Ready for ChatGPT / Claude
                    </span>
                  )}
                </div>
              </div>

              {/* Monospace Code Preview */}
              <div
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  overflowY: 'auto',
                  minHeight: 220,
                  maxHeight: 380,
                  fontFamily: "'Geist Mono', 'Fira Code', Menlo, Consolas, monospace",
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: isDark ? '#0A0914' : '#F8FAFC',
                  color: isDark ? '#E2E8F0' : '#1E293B',
                  borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'}`,
                }}
              >
                {exportedText || '// No prompts selected.'}
              </div>

              {/* Bottom Action Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: isDark ? '#0E0D1A' : '#FFFFFF',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: isDark ? D.textMuted : '#64748B',
                  }}
                >
                  <HelpCircle size={12} />
                  <span>Paste into any new AI conversation to continue seamlessly.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  <button
                    id="export-context-copy-btn"
                    onClick={handleCopy}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '7px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 180ms ease',
                      border: `1px solid ${copied ? '#10B981' : (isDark ? 'rgba(167,139,250,0.35)' : 'rgba(124,58,237,0.22)')}`,
                      background: copied
                        ? 'rgba(16, 185, 129, 0.15)'
                        : (isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(124, 58, 237, 0.08)'),
                      color: copied
                        ? '#10B981'
                        : (isDark ? '#C084FC' : '#6D28D9'),
                    }}
                  >
                    {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>

                  <button
                    id="export-context-download-btn"
                    onClick={handleDownload}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '7px 15px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      color: '#FFFFFF',
                      background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                      boxShadow: '0 3px 12px rgba(124, 58, 237, 0.35)',
                      transition: 'all 180ms ease',
                    }}
                  >
                    <Download size={13} />
                    <span>Download .{format}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

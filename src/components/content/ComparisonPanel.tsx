// ──────────────────────────────────────────────────────────────
// ComparisonPanel — Premium prompt comparison overlay
// ──────────────────────────────────────────────────────────────

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { diffWords } from 'diff';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { analyzePrompt, calculateImprovements } from '@/lib/analytics';
import { formatPromptText } from '@/lib/formatter';
import { FormattedPromptViewer } from '../common/FormattedPromptViewer';
import { RoleIcon } from '../common/RoleIcon';
import { EnhancementDepthControl } from '../common/EnhancementDepthControl';
import { useTheme } from '@/hooks/useTheme';
import { D, L } from '@/theme/tokens';

interface ComparisonPanelProps {
  adapter: SiteAdapter;
  onAccept: (text: string) => void;
  onReject: () => void;
  basePrompt?: string;
  baseLabel?: string;
  targetLabel?: string;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  adapter,
  onAccept,
  onReject,
  basePrompt,
  baseLabel,
  targetLabel,
}) => {
  const { isDark } = useTheme();
  const {
    flowState,
    currentPrompt,
    enhanceResult,
    recommendation,
    setShowRecommendation,
    streamingText,
    streamProgress,
    enhancementLevel,
    setEnhancementLevel,
  } = useEnhanceStore();

  const isStreaming = flowState === 'enhancing';
  const streamScrollRef = useRef<HTMLDivElement>(null);
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedSide, setCopiedSide] = useState<'original' | 'enhanced' | null>(null);

  // Auto-scroll stream container to bottom as tokens arrive
  useEffect(() => {
    if (isStreaming && streamScrollRef.current) {
      streamScrollRef.current.scrollTop = streamScrollRef.current.scrollHeight;
    }
  }, [streamingText, isStreaming]);

  // When flowState switches to 'enhancing', always show the panel
  // (even before the first token arrives) so the user sees it open immediately.
  const shouldRender = isStreaming || !!enhanceResult || !!streamingText;
  if (!shouldRender) return null;

  const originalPrompt = basePrompt || enhanceResult?.originalPrompt || currentPrompt || '';
  const rawEnhancedPrompt = isStreaming ? streamingText : (enhanceResult?.enhancedPrompt || streamingText || '');
  const enhancedPrompt = enhanceResult ? formatPromptText(rawEnhancedPrompt) : rawEnhancedPrompt;
  const finalText = isEditing ? editedText : enhancedPrompt;

  const leftLabel = baseLabel || 'Original';
  const rightLabel = targetLabel || (baseLabel ? 'Re-enhanced' : 'Enhanced');

  const diffResult = useMemo(
    () => (!isStreaming && enhanceResult ? diffWords(originalPrompt, enhancedPrompt) : []),
    [originalPrompt, enhancedPrompt, isStreaming, enhanceResult]
  );

  const originalAnalytics = useMemo(() => analyzePrompt(originalPrompt), [originalPrompt]);
  const enhancedAnalytics = useMemo(
    () => (!isStreaming && enhanceResult ? analyzePrompt(enhancedPrompt) : null),
    [enhancedPrompt, isStreaming, enhanceResult]
  );
  const improvements = useMemo(
    () => (originalAnalytics && enhancedAnalytics ? calculateImprovements(originalAnalytics, enhancedAnalytics) : null),
    [originalAnalytics, enhancedAnalytics]
  );

  const detectedDepth = enhanceResult?.detectedLevel;
  const activeDepth = detectedDepth || (enhancementLevel !== 'auto' ? enhancementLevel : undefined);

  const handleCopy = async (text: string, side: 'original' | 'enhanced') => {
    await navigator.clipboard.writeText(text);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  };

  const handleEdit = () => {
    setEditedText(enhancedPrompt);
    setIsEditing(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center"
        style={{
          zIndex: 2147483647,
          pointerEvents: 'auto',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onReject(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="overflow-hidden w-[800px] max-w-[90vw] max-h-[85vh] flex flex-col"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            background: isDark ? D.surface : '#FFFFFF',
            borderRadius: 20,
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #ECE9FF',
            boxShadow: isDark ? '0 24px 48px -12px rgba(0, 0, 0, 0.6)' : '0 24px 48px -12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF',
              background: isDark ? D.surfaceElevated : 'linear-gradient(135deg, #FAFAFE, #F5F3FF)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', color: '#fff' }}
              >
                <RoleIcon name="Sparkles" size={16} strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold" style={{ color: isDark ? D.textPrimary : '#1a1a2e', letterSpacing: '-0.02em' }}>
                    {baseLabel ? 'Prompt Re-enhancement' : 'Prompt Comparison'}
                  </h2>
                  {activeDepth && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: isDark ? '#C084FC' : '#7C3AED',
                        background: isDark ? 'rgba(139, 92, 246, 0.18)' : '#EDE9FE',
                        border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.2)'}`,
                        padding: '1.5px 7px',
                        borderRadius: 9999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3.5,
                      }}
                      title={enhanceResult?.levelReason ? `Depth: ${enhanceResult.levelReason}` : undefined}
                    >
                      <RoleIcon
                        name={activeDepth === 'minimal' ? 'Feather' : activeDepth === 'deep' ? 'Layers' : activeDepth === 'auto' ? 'Zap' : 'Sparkles'}
                        size={10.5}
                        strokeWidth={2.2}
                      />
                      <span>{activeDepth}</span>
                    </span>
                  )}
                </div>
                <p className="text-[12px]" style={{ color: isDark ? D.textSecondary : '#8E8EA0' }}>
                  {baseLabel ? 'Review the re-enhanced prompt before applying' : 'Review the enhancement before applying'}
                </p>
              </div>
            </div>
            <button
              onClick={onReject}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{ color: isDark ? D.textSecondary : '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isDark ? D.textSecondary : '#8E8EA0'; }}
            >
              <RoleIcon name="X" size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Comparison Area */}
          <div className="flex-1 overflow-auto p-6 pe-scrollbar" style={{ background: isDark ? D.bg : '#FAFAFE' }}>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {/* Original / Existing */}
              <div
                className="rounded-xl overflow-hidden flex flex-col"
                style={{
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF',
                  background: isDark ? D.surface : '#FFFFFF',
                }}
              >
                <div
                  className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
                  style={{ borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF' }}
                >
                  <span className="text-[12px] font-semibold" style={{ color: isDark ? D.textSecondary : '#8E8EA0' }}>{leftLabel}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: isDark ? D.textMuted : '#c4c4d4' }}>
                      {originalAnalytics.wordCount}w · {originalAnalytics.tokenCount}t
                    </span>
                    <button
                      onClick={() => handleCopy(originalPrompt, 'original')}
                      className="flex items-center gap-1 transition-colors duration-150"
                      style={{ fontSize: 11, color: isDark ? D.textSecondary : '#8E8EA0', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <RoleIcon name={copiedSide === 'original' ? 'Check' : 'Copy'} size={12} />
                      {copiedSide === 'original' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="p-4 overflow-y-auto max-h-[360px] custom-scrollbar flex-1">
                  <p className="text-[13px] whitespace-pre-wrap leading-relaxed m-0" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
                    {originalPrompt}
                  </p>
                </div>
              </div>

              {/* Enhanced / Re-enhanced */}
              <div
                className="rounded-xl overflow-hidden flex flex-col"
                style={{
                  border: isDark ? '1px solid rgba(124, 92, 252, 0.3)' : '1px solid #A78BFA40',
                  background: isDark ? 'rgba(124, 92, 252, 0.08)' : '#F5F3FF20',
                }}
              >
                <div
                  className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
                  style={{ borderBottom: isDark ? '1px solid rgba(124, 92, 252, 0.2)' : '1px solid #A78BFA30' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: isDark ? '#A78BFA' : '#7C5CFC' }}>{rightLabel}</span>
                    {isStreaming && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#FFFFFF',
                          background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                          padding: '2px 8px',
                          borderRadius: 99,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        Optimizing... {streamProgress > 0 ? `${streamProgress}%` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {enhancedAnalytics && (
                      <span className="text-[11px]" style={{ color: isDark ? D.textMuted : '#c4c4d4' }}>
                        {enhancedAnalytics.wordCount}w · {enhancedAnalytics.tokenCount}t
                      </span>
                    )}
                    {!isStreaming && (
                      <button
                        onClick={() => handleCopy(finalText, 'enhanced')}
                        className="flex items-center gap-1 transition-colors duration-150"
                        style={{ fontSize: 11, color: isDark ? D.textSecondary : '#8E8EA0', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <RoleIcon name={copiedSide === 'enhanced' ? 'Check' : 'Copy'} size={12} />
                        {copiedSide === 'enhanced' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
                <div
                  ref={streamScrollRef}
                  className="p-4 overflow-y-auto max-h-[360px] custom-scrollbar flex-1"
                >
                  {isEditing ? (
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full bg-transparent text-[13px] resize-none outline-none min-h-[160px] leading-relaxed"
                      style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}
                      autoFocus
                    />
                  ) : isStreaming && !streamingText ? (
                    // Backend is processing — no tokens yet. Show a friendly waiting state.
                    <div className="flex flex-col items-center justify-center gap-4 py-10">
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-[3px] border-violet-500/20" />
                        <div className="absolute inset-0 rounded-full border-[3px] border-t-violet-500 animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-[13px] font-semibold mb-1" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
                          {baseLabel ? 'AI is re-enhancing your prompt…' : 'AI is enhancing your prompt…'}
                        </p>
                        <p className="text-[11px]" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>
                          {streamProgress > 0
                            ? `Stage ${streamProgress}% complete`
                            : 'Analyzing and optimizing…'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <FormattedPromptViewer
                      content={isStreaming ? streamingText : enhancedPrompt}
                      isStreaming={isStreaming}
                      fontSize={13}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Diff View (Only when completed) */}
            {!isStreaming && diffResult.length > 0 && (
              <div
                className="mb-5 rounded-xl overflow-hidden"
                style={{
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF',
                  background: isDark ? D.surface : '#FFFFFF',
                }}
              >
                <div className="px-4 py-2.5" style={{ borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF' }}>
                  <span className="text-[12px] font-semibold" style={{ color: isDark ? D.textSecondary : '#8E8EA0' }}>Changes</span>
                </div>
                <div className="p-4">
                  <div className="text-[13px] leading-relaxed">
                    {diffResult.map((part, i) => (
                      <span
                        key={i}
                        style={{
                          background: part.added
                            ? (isDark ? 'rgba(52, 211, 153, 0.2)' : 'rgba(52, 211, 153, 0.12)')
                            : part.removed
                            ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)')
                            : 'transparent',
                          color: part.added
                            ? (isDark ? '#34D399' : '#059669')
                            : part.removed
                            ? (isDark ? '#F87171' : '#dc2626')
                            : (isDark ? D.textPrimary : '#1a1a2e'),
                          textDecoration: part.removed ? 'line-through' : 'none',
                          padding: part.added || part.removed ? '1px 3px' : 0,
                          borderRadius: 3,
                        }}
                      >
                        {part.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Overall Score & 6 Dimensions Grid */}
            {(() => {
              if (isStreaming || !enhanceResult) {
                return (
                  <div
                    className="rounded-2xl p-6 mb-5 flex flex-col items-center justify-center gap-3 text-center"
                    style={{
                      background: isDark ? D.surface : '#FFFFFF',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF',
                    }}
                  >
                    <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? D.textSecondary : '#64748B' }}>
                      Streaming enhanced prompt in real-time... Dimension scores will appear upon completion.
                    </span>
                  </div>
                );
              }

              const origAnalysis = enhanceResult?.originalAnalysis;
              const enhAnalysis = enhanceResult?.enhancedAnalysis;

              const getDimScore = (analysis: any, keys: string[], fallback: number): number => {
                if (!analysis?.dimensions) return fallback;
                for (const key of keys) {
                  const item = (analysis.dimensions as Record<string, any>)?.[key];
                  if (item && typeof item.score === 'number' && !isNaN(item.score)) {
                    return Math.max(0, Math.min(100, Math.round(item.score)));
                  }
                }
                return fallback;
              };

              const getDimDesc = (analysis: any, keys: string[], fallbackDesc: string): string => {
                if (!analysis?.dimensions) return fallbackDesc;
                for (const key of keys) {
                  const item = (analysis.dimensions as Record<string, any>)?.[key];
                  if (item?.explanation && typeof item.explanation === 'string' && item.explanation.trim()) {
                    return item.explanation;
                  }
                }
                return fallbackDesc;
              };

              const clarityBefore = getDimScore(origAnalysis, ['clarity'], 50);
              const clarityAfter = getDimScore(enhAnalysis, ['clarity'], 90);
              const clarityDesc = getDimDesc(enhAnalysis, ['clarity'], 'Instructions are direct and unambiguous.');

              const contextBefore = getDimScore(origAnalysis, ['context'], 45);
              const contextAfter = getDimScore(enhAnalysis, ['context'], 95);
              const contextDesc = getDimDesc(enhAnalysis, ['context'], 'Sufficient background information provided.');

              const roleBefore = getDimScore(origAnalysis, ['role_definition', 'role'], 32);
              const roleAfter = getDimScore(enhAnalysis, ['role_definition', 'role'], 85);
              const roleDesc = getDimDesc(enhAnalysis, ['role_definition', 'role'], 'Requested role-specific perspective.');

              const formatBefore = getDimScore(origAnalysis, ['output_format', 'format'], 55);
              const formatAfter = getDimScore(enhAnalysis, ['output_format', 'format'], 90);
              const formatDesc = getDimDesc(enhAnalysis, ['output_format', 'format'], 'Output structure clearly defined.');

              const constraintsBefore = getDimScore(origAnalysis, ['constraints'], 40);
              const constraintsAfter = getDimScore(enhAnalysis, ['constraints'], 84);
              const constraintsDesc = getDimDesc(enhAnalysis, ['constraints'], 'Negative constraints could be stricter.');

              const examplesBefore = getDimScore(origAnalysis, ['examples'], 28);
              const examplesAfter = getDimScore(enhAnalysis, ['examples'], 65);
              const examplesDesc = getDimDesc(enhAnalysis, ['examples'], 'Zero-shot approach used.');

              const dimensions = [
                {
                  id: 'clarity',
                  label: 'Clarity',
                  status: clarityAfter >= 75 ? 'good' : 'warning',
                  desc: clarityDesc,
                  scoreBefore: clarityBefore,
                  scoreAfter: clarityAfter,
                },
                {
                  id: 'context',
                  label: 'Context',
                  status: contextAfter >= 75 ? 'good' : 'warning',
                  desc: contextDesc,
                  scoreBefore: contextBefore,
                  scoreAfter: contextAfter,
                },
                {
                  id: 'role',
                  label: 'Role',
                  status: roleAfter >= 75 ? 'good' : 'neutral',
                  desc: roleDesc,
                  scoreBefore: roleBefore,
                  scoreAfter: roleAfter,
                },
                {
                  id: 'format',
                  label: 'Format',
                  status: formatAfter >= 75 ? 'good' : 'neutral',
                  desc: formatDesc,
                  scoreBefore: formatBefore,
                  scoreAfter: formatAfter,
                },
                {
                  id: 'constraints',
                  label: 'Constraints',
                  status: constraintsAfter >= 75 ? 'good' : 'warning',
                  desc: constraintsDesc,
                  scoreBefore: constraintsBefore,
                  scoreAfter: constraintsAfter,
                },
                {
                  id: 'examples',
                  label: 'Examples',
                  status: examplesAfter >= 75 ? 'good' : 'neutral',
                  desc: examplesDesc,
                  scoreBefore: examplesBefore,
                  scoreAfter: examplesAfter,
                },
              ];

              const overallBefore = typeof origAnalysis?.overall_score === 'number'
                ? Math.round(origAnalysis.overall_score)
                : Math.round(dimensions.reduce((acc, d) => acc + d.scoreBefore, 0) / dimensions.length);

              const overallAfter = typeof enhAnalysis?.overall_score === 'number'
                ? Math.round(enhAnalysis.overall_score)
                : Math.round(dimensions.reduce((acc, d) => acc + d.scoreAfter, 0) / dimensions.length);

              const ptsGain = overallAfter - overallBefore;

              const getScoreLabel = (score: number) => {
                if (score >= 90) return 'Excellent';
                if (score >= 75) return 'Good';
                if (score >= 55) return 'Fair';
                return 'Needs Work';
              };

              const scoreLabelText = getScoreLabel(overallAfter);
              const strokeDasharray = 2 * Math.PI * 42; // ~263.89
              const strokeDashoffset = strokeDasharray - (overallAfter / 100) * strokeDasharray;

              return (
                <div
                  className="rounded-2xl p-5 mb-5"
                  style={{
                    background: isDark ? D.surface : '#FFFFFF',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF',
                    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(124, 92, 252, 0.05)',
                  }}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Column: Overall Ring & Before/After */}
                    <div
                      className="w-[170px] flex-shrink-0 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r pb-4 md:pb-0 md:pr-6"
                      style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ECE9FF' }}
                    >
                      <div className="relative w-28 h-28 flex items-center justify-center mb-2">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke={isDark ? '#211E30' : '#F1F5F9'}
                            strokeWidth="8"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="url(#purpleScoreGradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                          />
                          <defs>
                            <linearGradient id="purpleScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#7C5CFC" />
                              <stop offset="100%" stopColor="#9D7BFF" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-extrabold tracking-tight" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
                            {overallAfter}
                          </span>
                        </div>
                      </div>

                      <div className="text-[15px] font-bold text-[#7C5CFC] mb-2">
                        {scoreLabelText}
                      </div>

                      <div
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-3"
                        style={{
                          color: '#10B981',
                          background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #A7F3D0',
                        }}
                      >
                        <RoleIcon name="TrendingUp" size={12} />
                        <span>+{ptsGain} pts</span>
                      </div>

                      <div className="w-full space-y-1 text-[12px]">
                        <div className="flex justify-between items-center" style={{ color: isDark ? D.textMuted : '#64748B' }}>
                          <span>Before</span>
                          <span className="font-semibold">{overallBefore}</span>
                        </div>
                        <div className="flex justify-between items-center" style={{ color: isDark ? D.textMuted : '#64748B' }}>
                          <span>After</span>
                          <span className="font-bold text-[#10B981]">{overallAfter}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: 6 Dimension Cards Grid */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dimensions.map((dim) => {
                        const isGood = dim.status === 'good';
                        const isWarning = dim.status === 'warning';
                        return (
                          <div
                            key={dim.id}
                            className="relative rounded-xl p-3.5 flex flex-col justify-between overflow-hidden transition-all duration-150 hover:-translate-y-0.5"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(124, 92, 252, 0.02)',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(124, 92, 252, 0.08)',
                            }}
                          >
                            {/* Left accent bar */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md"
                              style={{
                                background: isGood
                                  ? 'linear-gradient(180deg, #10B981, #34D399)'
                                  : 'linear-gradient(180deg, #7C5CFC, #A78BFA)',
                              }}
                            />

                            <div className="pl-1">
                              {/* Header row */}
                              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span style={{ color: isGood ? '#10B981' : isWarning ? '#7C5CFC' : (isDark ? D.textMuted : '#94A3B8') }}>
                                    <RoleIcon
                                      name={isGood ? 'CheckCircle' : isWarning ? 'AlertTriangle' : 'Minus'}
                                      size={14}
                                      strokeWidth={2}
                                    />
                                  </span>
                                  <span className="text-[13px] font-semibold truncate" style={{ color: isDark ? D.textPrimary : '#1a1a2e' }}>
                                    {dim.label}
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold flex items-center gap-1 flex-shrink-0">
                                  <span style={{ color: isDark ? D.textMuted : '#94A3B8' }}>{dim.scoreBefore}</span>
                                  <span style={{ color: isDark ? D.border : '#CBD5E1' }} className="text-[9px]">→</span>
                                  <span
                                    className="font-bold"
                                    style={{ color: isGood ? '#10B981' : '#7C5CFC' }}
                                  >
                                    {dim.scoreAfter}
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div
                                className="h-[3px] w-full rounded-full overflow-hidden mb-2"
                                style={{ background: isDark ? '#211E30' : '#ECE9FF' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${dim.scoreAfter}%`,
                                    background: isGood ? '#10B981' : '#7C5CFC',
                                  }}
                                />
                              </div>

                              {/* Description */}
                              <p className="text-[11px] leading-tight m-0" style={{ color: isDark ? D.textMuted : '#64748B' }}>
                                {dim.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Action Bar */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #ECE9FF',
              background: isDark ? D.surface : '#FFFFFF',
            }}
          >
            <div className="flex gap-2">
              {!isStreaming && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200"
                  style={{ fontSize: 13, fontWeight: 500, color: isDark ? D.textSecondary : '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isDark ? D.textSecondary : '#8E8EA0'; }}
                >
                  <RoleIcon name="Pencil" size={14} />
                  {isEditing ? 'Preview' : 'Edit'}
                </button>
              )}
              {!isStreaming && recommendation && (
                <button
                  onClick={() => setShowRecommendation(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200"
                  style={{ fontSize: 13, fontWeight: 500, color: isDark ? D.textSecondary : '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isDark ? D.textSecondary : '#8E8EA0'; }}
                >
                  <RoleIcon name="Bot" size={14} />
                  AI Recommendation
                </button>
              )}
            </div>

            {/* Center: Compact Enhancement Depth Selector */}
            <div style={{ maxWidth: 280, flex: 1, margin: '0 12px' }}>
              <EnhancementDepthControl
                value={enhancementLevel}
                onChange={setEnhancementLevel}
                showTitle={false}
                compact={true}
                layoutIdPrefix="comparePanelDepth"
                disabled={isStreaming}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={onReject}
                className="px-5 py-2.5 rounded-xl transition-all duration-200"
                style={{
                  fontSize: 13, fontWeight: 500, color: isDark ? D.textSecondary : '#8E8EA0',
                  background: 'transparent',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #ECE9FF',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#F5F3FF'; e.currentTarget.style.borderColor = '#A78BFA'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ECE9FF'; }}
              >
                {isStreaming ? 'Cancel' : 'Close'}
              </button>
              {!isStreaming && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onAccept(finalText)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                  style={{
                    fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <RoleIcon name="ArrowDownToLine" size={15} strokeWidth={2.5} />
                  Insert into Chat
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

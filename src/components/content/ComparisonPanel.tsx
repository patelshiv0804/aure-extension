// ──────────────────────────────────────────────────────────────
// ComparisonPanel — Premium prompt comparison overlay
// ──────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { diffWords } from 'diff';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { analyzePrompt, calculateImprovements } from '@/lib/analytics';
import { RoleIcon } from '../common/RoleIcon';

interface ComparisonPanelProps {
  adapter: SiteAdapter;
  onAccept: (text: string) => void;
  onReject: () => void;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  onAccept,
  onReject,
}) => {
  const { enhanceResult, recommendation, setShowRecommendation } = useEnhanceStore();
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedSide, setCopiedSide] = useState<'original' | 'enhanced' | null>(null);

  if (!enhanceResult) return null;

  const { originalPrompt, enhancedPrompt, metrics } = enhanceResult;
  const finalText = isEditing ? editedText : enhancedPrompt;

  const diffResult = useMemo(
    () => diffWords(originalPrompt, enhancedPrompt),
    [originalPrompt, enhancedPrompt]
  );

  const originalAnalytics = useMemo(() => analyzePrompt(originalPrompt), [originalPrompt]);
  const enhancedAnalytics = useMemo(() => analyzePrompt(enhancedPrompt), [enhancedPrompt]);
  const improvements = useMemo(
    () => calculateImprovements(originalAnalytics, enhancedAnalytics),
    [originalAnalytics, enhancedAnalytics]
  );

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
            background: '#FFFFFF',
            borderRadius: 20,
            border: '1px solid #ECE9FF',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid #ECE9FF', background: 'linear-gradient(135deg, #FAFAFE, #F5F3FF)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', color: '#fff' }}
              >
                <RoleIcon name="Sparkles" size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: '#1a1a2e', letterSpacing: '-0.02em' }}>
                  Prompt Comparison
                </h2>
                <p className="text-[12px]" style={{ color: '#8E8EA0' }}>
                  Review the enhancement before applying
                </p>
              </div>
            </div>
            <button
              onClick={onReject}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{ color: '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
            >
              <RoleIcon name="X" size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Comparison Area */}
          <div className="flex-1 overflow-auto p-6 pe-scrollbar" style={{ background: '#FAFAFE' }}>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {/* Original */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #ECE9FF', background: '#FFFFFF' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #ECE9FF' }}>
                  <span className="text-[12px] font-semibold" style={{ color: '#8E8EA0' }}>Original</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: '#c4c4d4' }}>
                      {originalAnalytics.wordCount}w · {originalAnalytics.tokenCount}t
                    </span>
                    <button
                      onClick={() => handleCopy(originalPrompt, 'original')}
                      className="flex items-center gap-1 transition-colors duration-150"
                      style={{ fontSize: 11, color: '#8E8EA0', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <RoleIcon name={copiedSide === 'original' ? 'Check' : 'Copy'} size={12} />
                      {copiedSide === 'original' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#1a1a2e' }}>
                    {originalPrompt}
                  </p>
                </div>
              </div>

              {/* Enhanced */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #A78BFA40', background: '#F5F3FF20' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #A78BFA30' }}>
                  <span className="text-[12px] font-semibold" style={{ color: '#7C5CFC' }}>Enhanced</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: '#c4c4d4' }}>
                      {enhancedAnalytics.wordCount}w · {enhancedAnalytics.tokenCount}t
                    </span>
                    <button
                      onClick={() => handleCopy(enhancedPrompt, 'enhanced')}
                      className="flex items-center gap-1 transition-colors duration-150"
                      style={{ fontSize: 11, color: '#8E8EA0', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <RoleIcon name={copiedSide === 'enhanced' ? 'Check' : 'Copy'} size={12} />
                      {copiedSide === 'enhanced' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {isEditing ? (
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full bg-transparent text-[13px] resize-none outline-none min-h-[120px] leading-relaxed"
                      style={{ color: '#1a1a2e' }}
                      autoFocus
                    />
                  ) : (
                    <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#1a1a2e' }}>
                      {enhancedPrompt}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Diff View */}
            <div className="mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid #ECE9FF', background: '#FFFFFF' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #ECE9FF' }}>
                <span className="text-[12px] font-semibold" style={{ color: '#8E8EA0' }}>Changes</span>
              </div>
              <div className="p-4">
                <div className="text-[13px] leading-relaxed">
                  {diffResult.map((part, i) => (
                    <span
                      key={i}
                      style={{
                        background: part.added ? 'rgba(52, 211, 153, 0.12)' : part.removed ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        color: part.added ? '#059669' : part.removed ? '#dc2626' : '#1a1a2e',
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

            {/* Overall Score & 6 Dimensions Grid (Image 1 Layout) */}
            {(() => {
              const origAnalysis = enhanceResult.originalAnalysis;
              const enhAnalysis = enhanceResult.enhancedAnalysis;

              const getDimScore = (analysis: typeof origAnalysis, keys: string[], fallback: number): number => {
                if (!analysis?.dimensions) return fallback;
                for (const key of keys) {
                  const item = (analysis.dimensions as Record<string, any>)?.[key];
                  if (item && typeof item.score === 'number' && !isNaN(item.score)) {
                    return Math.max(0, Math.min(100, Math.round(item.score)));
                  }
                }
                return fallback;
              };

              const getDimDesc = (analysis: typeof enhAnalysis, keys: string[], fallbackDesc: string): string => {
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
                    background: '#FFFFFF',
                    border: '1px solid #ECE9FF',
                    boxShadow: '0 4px 20px rgba(124, 92, 252, 0.05)',
                  }}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Column: Overall Ring & Before/After */}
                    <div className="w-[170px] flex-shrink-0 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[#ECE9FF] pb-4 md:pb-0 md:pr-6">
                      <div className="relative w-28 h-28 flex items-center justify-center mb-2">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="#F1F5F9"
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
                          <span className="text-3xl font-extrabold text-[#1a1a2e] tracking-tight">
                            {overallAfter}
                          </span>
                        </div>
                      </div>

                      <div className="text-[15px] font-bold text-[#7C5CFC] mb-2">
                        {scoreLabelText}
                      </div>

                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-0.5 rounded-full mb-3">
                        <RoleIcon name="TrendingUp" size={12} />
                        <span>+{ptsGain} pts</span>
                      </div>

                      <div className="w-full space-y-1 text-[12px]">
                        <div className="flex justify-between items-center text-[#64748B]">
                          <span>Before</span>
                          <span className="font-semibold text-[#64748B]">{overallBefore}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#64748B]">
                          <span>After</span>
                          <span className="font-bold text-[#059669]">{overallAfter}</span>
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
                              background: 'rgba(124, 92, 252, 0.02)',
                              border: '1px solid rgba(124, 92, 252, 0.08)',
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
                                  <span style={{ color: isGood ? '#10B981' : isWarning ? '#7C5CFC' : '#94A3B8' }}>
                                    <RoleIcon
                                      name={isGood ? 'CheckCircle' : isWarning ? 'AlertTriangle' : 'Minus'}
                                      size={14}
                                      strokeWidth={2}
                                    />
                                  </span>
                                  <span className="text-[13px] font-semibold text-[#1a1a2e] truncate">
                                    {dim.label}
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold flex items-center gap-1 flex-shrink-0">
                                  <span className="text-[#94A3B8]">{dim.scoreBefore}</span>
                                  <span className="text-[#CBD5E1] text-[9px]">→</span>
                                  <span
                                    className="font-bold"
                                    style={{ color: isGood ? '#059669' : '#7C5CFC' }}
                                  >
                                    {dim.scoreAfter}
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="h-[3px] w-full bg-[#ECE9FF] rounded-full overflow-hidden mb-2">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${dim.scoreAfter}%`,
                                    background: isGood ? '#10B981' : '#7C5CFC',
                                  }}
                                />
                              </div>

                              {/* Description */}
                              <p className="text-[11px] text-[#64748B] leading-tight m-0">
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
            style={{ borderTop: '1px solid #ECE9FF', background: '#FFFFFF' }}
          >
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200"
                style={{ fontSize: 13, fontWeight: 500, color: '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
              >
                <RoleIcon name="Pencil" size={14} />
                {isEditing ? 'Preview' : 'Edit'}
              </button>
              {recommendation && (
                <button
                  onClick={() => setShowRecommendation(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200"
                  style={{ fontSize: 13, fontWeight: 500, color: '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
                >
                  <RoleIcon name="Bot" size={14} />
                  AI Recommendation
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onReject}
                className="px-5 py-2.5 rounded-xl transition-all duration-200"
                style={{
                  fontSize: 13, fontWeight: 500, color: '#8E8EA0',
                  background: 'transparent', border: '1px solid #ECE9FF', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.borderColor = '#A78BFA'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ECE9FF'; }}
              >
                Discard
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAccept(finalText)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                style={{
                  fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                  background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
                  boxShadow: '0 4px 12px rgba(124, 92, 252, 0.3)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <RoleIcon name="Check" size={15} strokeWidth={2.5} />
                Accept & Apply
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

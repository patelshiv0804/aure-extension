// ──────────────────────────────────────────────────────────────
// ModelRecommendation — Premium AI model suggestion card
// ──────────────────────────────────────────────────────────────

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { MODEL_MAP, AI_MODELS } from '@/constants/models';
import { RoleIcon } from '../common/RoleIcon';

interface ModelRecommendationProps {
  adapter: SiteAdapter;
}

export const ModelRecommendation: React.FC<ModelRecommendationProps> = ({ adapter }) => {
  const { enhanceResult, recommendation, flowState, setFlowState } = useEnhanceStore();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  if (!enhanceResult) return null;
  if (flowState !== 'injected' && flowState !== 'comparing') return null;

  const currentId = `${enhanceResult.timestamp}-${enhanceResult.originalPrompt.slice(0, 10)}`;
  if (dismissedId === currentId) return null;

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

  const clarityBefore = getDimScore(origAnalysis, ['clarity'], 50);
  const clarityAfter = getDimScore(enhAnalysis, ['clarity'], 90);

  const contextBefore = getDimScore(origAnalysis, ['context'], 45);
  const contextAfter = getDimScore(enhAnalysis, ['context'], 95);

  const roleBefore = getDimScore(origAnalysis, ['role_definition', 'role'], 32);
  const roleAfter = getDimScore(enhAnalysis, ['role_definition', 'role'], 85);

  const formatBefore = getDimScore(origAnalysis, ['output_format', 'format'], 55);
  const formatAfter = getDimScore(enhAnalysis, ['output_format', 'format'], 90);

  const constraintsBefore = getDimScore(origAnalysis, ['constraints'], 40);
  const constraintsAfter = getDimScore(enhAnalysis, ['constraints'], 84);

  const examplesBefore = getDimScore(origAnalysis, ['examples'], 28);
  const examplesAfter = getDimScore(enhAnalysis, ['examples'], 65);

  const dimensions = [
    { label: 'Clarity', before: clarityBefore, after: clarityAfter },
    { label: 'Context', before: contextBefore, after: contextAfter },
    { label: 'Role', before: roleBefore, after: roleAfter },
    { label: 'Format', before: formatBefore, after: formatAfter },
    { label: 'Constraints', before: constraintsBefore, after: constraintsAfter },
    { label: 'Examples', before: examplesBefore, after: examplesAfter },
  ];

  const overallBefore = typeof origAnalysis?.overall_score === 'number'
    ? Math.round(origAnalysis.overall_score)
    : Math.round(dimensions.reduce((acc, d) => acc + d.before, 0) / dimensions.length);

  const overallAfter = typeof enhAnalysis?.overall_score === 'number'
    ? Math.round(enhAnalysis.overall_score)
    : Math.round(dimensions.reduce((acc, d) => acc + d.after, 0) / dimensions.length);

  const ptsGain = Math.max(0, overallAfter - overallBefore);

  const rawTopTools = recommendation?.topTools ?? enhanceResult?.toolRecommendations;
  const defaultTools = [
    { name: 'ChatGPT', rank: 1, url: 'https://chatgpt.com/' },
    { name: 'Claude', rank: 2, url: 'https://claude.ai/' },
    { name: 'Gemini', rank: 3, url: 'https://gemini.google.com/' },
  ];

  const top3Tools = (rawTopTools && rawTopTools.length > 0)
    ? rawTopTools.slice(0, 3).map((t) => {
        const info = MODEL_MAP[t.name.toLowerCase()] ?? AI_MODELS.find(m => m.name.toLowerCase() === t.name.toLowerCase());
        return {
          name: t.name,
          rank: t.rank,
          url: t.url || info?.url || `https://www.google.com/search?q=${encodeURIComponent(t.name + ' AI')}`,
        };
      })
    : defaultTools;

  return (
    <AnimatePresence>
      <motion.div
        key={currentId}
        initial={{ opacity: 0, x: 30, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="fixed top-4 right-4"
        style={{
          zIndex: 2147483646,
          pointerEvents: 'auto',
          width: 320,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid #ECE9FF',
            boxShadow: '0 20px 48px -10px rgba(124, 92, 252, 0.18), 0 0 0 1px rgba(124, 92, 252, 0.06)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #ECE9FF', background: 'linear-gradient(135deg, #FAFAFE, #F5F3FF)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)', color: '#FFFFFF' }}
              >
                <RoleIcon name="Sparkles" size={13} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-[#1a1a2e]">
                Prompt Quality Scores
              </span>
            </div>
            <button
              onClick={() => setDismissedId(currentId)}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-150"
              style={{ color: '#8E8EA0', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
            >
              <RoleIcon name="X" size={13} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Overall Score Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F3FF] border border-[#ECE9FF]">
              <div>
                <div className="text-[10px] font-bold text-[#7C5CFC] uppercase tracking-wider mb-0.5">Overall Score</div>
                <div className="flex items-center gap-1.5 text-[14px]">
                  <span className="text-[#64748B] font-semibold">{overallBefore}</span>
                  <span className="text-[#CBD5E1] text-[10px]">→</span>
                  <span className="font-extrabold text-[#059669]">{overallAfter}</span>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-1 rounded-full">
                <RoleIcon name="TrendingUp" size={12} />
                <span>+{ptsGain} pts</span>
              </div>
            </div>

            {/* 6 Dimensions Grid with explicit Before & After column header */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-[#8E8EA0] uppercase tracking-wider mb-1.5 px-0.5">
                <span>6 Dimension Breakdown</span>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-[#8E8EA0]">Before</span>
                  <span className="text-[#CBD5E1] text-[9px]">→</span>
                  <span className="text-[#059669]">After</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {dimensions.map((d) => (
                  <div
                    key={d.label}
                    className="p-2 rounded-lg bg-[#FAFAFE] border border-[#ECE9FF] flex items-center justify-between text-[11px]"
                  >
                    <span className="font-semibold text-[#1a1a2e]">{d.label}</span>
                    <div className="flex items-center gap-1 font-bold">
                      <span className="text-[#8E8EA0] text-[10px] font-normal">{d.before}</span>
                      <span className="text-[#CBD5E1] text-[9px]">→</span>
                      <span className="text-[11px]" style={{ color: d.after >= 75 ? '#059669' : '#7C5CFC' }}>{d.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Recommended AI Models Navigation */}
            <div className="pt-2 border-t border-[#ECE9FF] space-y-2">
              <div className="text-[10px] font-bold text-[#7C5CFC] uppercase tracking-wider">
                Recommended AI Models
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {top3Tools.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: '#F5F3FF',
                      border: '1px solid #ECE9FF',
                      color: '#7C5CFC',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #7C5CFC, #9D7BFF)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#F5F3FF';
                      e.currentTarget.style.color = '#7C5CFC';
                    }}
                    title={`Open ${tool.name}`}
                  >
                    <span className="truncate">{tool.name}</span>
                    <RoleIcon name="ExternalLink" size={10} />
                  </a>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setFlowState('comparing')}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(124, 92, 252, 0.25)',
                  cursor: 'pointer',
                }}
              >
                Full Side-by-Side
              </button>
              <button
                onClick={() => setDismissedId(currentId)}
                className="px-3 py-2 rounded-xl text-[12px] font-medium text-[#8E8EA0] bg-transparent border border-[#ECE9FF] transition-all duration-200"
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C5CFC'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8EA0'; }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

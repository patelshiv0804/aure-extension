// ──────────────────────────────────────────────────────────────
// ModelRecommendation — Premium AI model suggestion card
// Compact Horizontal Scorecard Layout (Overall Score | 2x3 Dimensions | Top 3 AI Models)
// ──────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { MODEL_MAP, AI_MODELS } from '@/constants/models';
import { RoleIcon } from '../common/RoleIcon';

interface ModelRecommendationProps {
  adapter: SiteAdapter;
}

export const ModelRecommendation: React.FC<ModelRecommendationProps> = ({ adapter: _adapter }) => {
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
    ? rawTopTools.slice(0, 3).map((t, idx) => {
        const info = MODEL_MAP[t.name.toLowerCase()] ?? AI_MODELS.find(m => m.name.toLowerCase() === t.name.toLowerCase());
        return {
          name: t.name,
          rank: t.rank ?? (idx + 1),
          url: t.url || info?.url || `https://www.google.com/search?q=${encodeURIComponent(t.name + ' AI')}`,
        };
      })
    : defaultTools;

  return (
    <AnimatePresence>
      <motion.div
        key={currentId}
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 440, damping: 32 }}
        className="fixed top-3 right-4"
        style={{
          zIndex: 2147483646,
          pointerEvents: 'auto',
          width: 'fit-content',
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #ECE9FF',
            boxShadow: '0 14px 36px -8px rgba(124, 92, 252, 0.18), 0 0 0 1px rgba(124, 92, 252, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Top Header Bar */}
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #FAFAFE, #F5F3FF)',
              borderBottom: '1px solid #ECE9FF',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(124, 92, 252, 0.25)',
                }}
              >
                <RoleIcon name="Sparkles" size={10} strokeWidth={2.4} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E1B4B', letterSpacing: '-0.01em' }}>
                Prompt Quality Scores
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#7C5CFC',
                  background: 'rgba(124, 92, 252, 0.09)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  letterSpacing: '0.02em',
                }}
              >
                EVALUATION
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setFlowState('comparing')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3.5,
                  padding: '2.5px 7px',
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(124, 92, 252, 0.2)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <span>Side-by-Side</span>
                <RoleIcon name="Columns" size={9.5} strokeWidth={2.2} />
              </button>

              <button
                onClick={() => setDismissedId(currentId)}
                title="Dismiss score card"
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 5,
                  color: '#94A3B8',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#F5F3FF';
                  e.currentTarget.style.color = '#7C5CFC';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94A3B8';
                }}
              >
                <RoleIcon name="X" size={12} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Main Horizontal Content Body: 3 Distinct Sections */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 8,
              padding: '9px 11px',
            }}
          >
            {/* ── 1. Overall Score Card (First Section) ── */}
            <div
              style={{
                width: 125,
                flexShrink: 0,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #F8F6FF 0%, #F1EDFF 100%)',
                border: '1px solid #DDD6FE',
                padding: '7px 9px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#7C5CFC',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 3,
                  }}
                >
                  Overall Score
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#64748B' }}>
                    {overallBefore}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#A78BFA' }}>
                    →
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: overallAfter >= 80 ? '#059669' : '#7C5CFC',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {overallAfter}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: '#059669',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  padding: '1.5px 5px',
                  borderRadius: '5px',
                  width: 'fit-content',
                  marginTop: 4,
                }}
              >
                <RoleIcon name="TrendingUp" size={10} strokeWidth={2.5} />
                <span>+{ptsGain} pts</span>
              </div>
            </div>

            {/* ── 2. 6 Dimensions Breakdown in 2 x 3 Grid (Middle Section) ── */}
            <div
              style={{
                flex: 1,
                minWidth: 290,
                borderRadius: '10px',
                background: '#FAFAFE',
                border: '1px solid #ECE9FF',
                padding: '7px 9px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#8E8EA0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  6 Dimensions
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8.5, fontWeight: 700 }}>
                  <span style={{ color: '#8E8EA0' }}>Before</span>
                  <span style={{ color: '#CBD5E1', fontSize: 8 }}>→</span>
                  <span style={{ color: '#059669' }}>After</span>
                </div>
              </div>

              {/* 2 x 3 Grid (3 columns x 2 rows) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridTemplateRows: 'repeat(2, auto)',
                  gap: 5,
                }}
              >
                {dimensions.map((d) => (
                  <div
                    key={d.label}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #ECE9FF',
                      borderRadius: '7px',
                      padding: '4px 7px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#1E1B4B' }}>
                      {d.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 800 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 500, color: '#94A3B8' }}>
                        {d.before}
                      </span>
                      <span style={{ fontSize: 8, color: '#CBD5E1' }}>
                        →
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: d.after >= 80 ? '#059669' : '#7C5CFC',
                        }}
                      >
                        {d.after}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 3. Recommended AI Models (Last Section) ── */}
            <div
              style={{
                width: 145,
                flexShrink: 0,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)',
                border: '1px solid #E9D5FF',
                padding: '7px 9px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#7C5CFC',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 5,
                }}
              >
                Top AI Models
              </div>

              {/* 3 AI Models Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {top3Tools.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3.5px 6px',
                      borderRadius: '6px',
                      background: '#FFFFFF',
                      border: '1px solid #ECE9FF',
                      color: '#6D28D9',
                      fontSize: 10,
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #7C5CFC, #9D7BFF)';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#7C5CFC';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#FFFFFF';
                      e.currentTarget.style.color = '#6D28D9';
                      e.currentTarget.style.borderColor = '#ECE9FF';
                    }}
                    title={`Open ${tool.name}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          color: '#7C5CFC',
                          background: 'rgba(124, 92, 252, 0.09)',
                          padding: '0.5px 3px',
                          borderRadius: '3px',
                        }}
                      >
                        #{tool.rank}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tool.name}
                      </span>
                    </div>
                    <RoleIcon name="ExternalLink" size={9.5} strokeWidth={2.2} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

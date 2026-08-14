// ──────────────────────────────────────────────────────────────
// InlineSuggestions — Premium context-aware suggestions
// ──────────────────────────────────────────────────────────────

import React, { useMemo, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { RoleIcon } from '../common/RoleIcon';

interface InlineSuggestionsProps {
  adapter: SiteAdapter;
}

const SUGGESTION_ICONS: Record<string, string> = {
  'Add target audience': 'Target',
  'Add desired output format': 'ClipboardList',
  'Add examples for clarity': 'Lightbulb',
  'Add constraints or boundaries': 'Construction',
  'Specify desired length': 'Ruler',
  'Add step-by-step instructions': 'ListOrdered',
  'Add more detail to your prompt': 'PenLine',
};

// Estimated height per suggestion row + header + padding
const SUGGESTION_ROW_HEIGHT = 36;
const SUGGESTION_HEADER_HEIGHT = 34;
const SUGGESTION_PADDING = 16;
// Height of the AURE floating toolbar above the input
const AURE_TOOLBAR_HEIGHT = 44;

export const InlineSuggestions: React.FC<InlineSuggestionsProps> = ({ adapter }) => {
  const { suggestions, currentPrompt, setCurrentPrompt } = useEnhanceStore();
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const prevSuggestionsRef = React.useRef(suggestions.join(','));

  React.useEffect(() => {
    const currentStr = suggestions.join(',');
    if (currentStr !== prevSuggestionsRef.current) {
      prevSuggestionsRef.current = currentStr;
      setIsDismissed(false);
    }
  }, [suggestions]);

  // Measure once on mount and when suggestions change (not on every render)
  useLayoutEffect(() => {
    if (suggestions.length > 0) {
      setInputRect(adapter.getInputRect());
    }
  }, [adapter, suggestions.length]);

  if (isDismissed || suggestions.length === 0 || !inputRect) return null;

  // Estimate the panel height to decide if it fits below
  const estimatedPanelHeight =
    SUGGESTION_HEADER_HEIGHT + suggestions.length * SUGGESTION_ROW_HEIGHT + SUGGESTION_PADDING;
  const spaceBelow = window.innerHeight - inputRect.bottom;
  const showAbove = spaceBelow < estimatedPanelHeight + 16;

  const handleSuggestionClick = async (suggestion: string) => {
    const templates: Record<string, string> = {
      'Add target audience': '\n\nTarget audience: [specify your audience]',
      'Add desired output format': '\n\nOutput format: [specify format, e.g., bullet points, essay, code]',
      'Add examples for clarity': '\n\nExamples: [provide relevant examples]',
      'Add constraints or boundaries': '\n\nConstraints: [specify what to avoid or limits]',
      'Specify desired length': '\n\nDesired length: [short/medium/long/specific word count]',
      'Add step-by-step instructions': '\n\nSteps:\n1. [first step]\n2. [second step]\n3. [third step]',
      'Add more detail to your prompt': '',
    };

    const template = templates[suggestion] ?? '';
    if (template) {
      const newText = currentPrompt + template;
      try {
        await adapter.injectPrompt(newText);
        setCurrentPrompt(newText);
      } catch (e) {
        console.error('[AURE] Failed to inject suggestion:', e);
      }
    }
  };

  // Position: below the input, or above the AURE toolbar if not enough space
  const panelTop = showAbove
    ? inputRect.top - estimatedPanelHeight - AURE_TOOLBAR_HEIGHT - 8
    : inputRect.bottom + 8;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, y: showAbove ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: showAbove ? 4 : -4 }}
        transition={{ duration: 0.15 }}
        whileDrag={{ scale: 1.02, boxShadow: '0 16px 36px rgba(124, 92, 252, 0.18)' }}
        style={{
          position: 'fixed',
          left: inputRect.left,
          top: panelTop,
          zIndex: 2147483646,
          pointerEvents: 'auto',
          maxWidth: Math.min(inputRect.width, 350),
          cursor: 'grab',
        }}
      >
        <div
          className="rounded-xl overflow-hidden"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            background: '#FFFFFF',
            border: '1px solid #ECE9FF',
            boxShadow: showAbove
              ? '0 -8px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(124, 92, 252, 0.04)'
              : '0 8px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(124, 92, 252, 0.04)',
          }}
        >
          {/* Draggable Header with Close Button */}
          <div
            className="px-3 py-2 flex items-center justify-between gap-2 select-none cursor-grab active:cursor-grabbing"
            style={{ borderBottom: '1px solid #ECE9FF', background: '#FAFAFE' }}
          >
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#A78BFA', display: 'flex' }} title="Drag to reposition">
                <RoleIcon name="GripHorizontal" size={14} strokeWidth={2} />
              </span>
              <span style={{ color: '#7C5CFC', display: 'flex' }}>
                <RoleIcon name="Lightbulb" size={13} strokeWidth={2} />
              </span>
              <span className="text-[11px] font-bold" style={{ color: '#1a1a2e' }}>
                Suggestions
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDismissed(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Close Suggestions"
              className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <RoleIcon name="X" size={12} strokeWidth={2} />
            </button>
          </div>

          <div className="p-1.5">
            {suggestions.map((suggestion, i) => {
              const iconName = SUGGESTION_ICONS[suggestion] ?? 'Lightbulb';
              return (
                <motion.button
                  key={suggestion}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left"
                  style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ color: '#A78BFA' }}>
                    <RoleIcon name={iconName} size={14} strokeWidth={1.75} />
                  </span>
                  <span className="text-[12px]" style={{ color: '#1a1a2e' }}>
                    {suggestion}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};


import React, { useState } from 'react';
import { Copy, Check, Code as CodeIcon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface FormattedPromptViewerProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
  fontSize?: number;
}

export const FormattedPromptViewer: React.FC<FormattedPromptViewerProps> = ({
  content,
  isStreaming = false,
  className = '',
  fontSize = 11.5,
}) => {
  const { isDark, D } = useTheme();
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const Caret = () => (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 5,
        height: 13,
        marginLeft: 3,
        borderRadius: 1,
        background: isDark ? '#C084FC' : '#7C3AED',
        verticalAlign: 'text-bottom',
        animation: 'pulse 1s step-end infinite',
      }}
    />
  );

  if (!content || !content.trim()) {
    if (isStreaming) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 20 }}>
          <Caret />
        </div>
      );
    }
    return null;
  }

  let text = content.trim();

  // 1. Strip leading LLM meta markers like "ENHANCED PROMPT (Production-Ready):", "ENHANCED PROMPT:", etc.
  text = text.replace(/^(?:#{1,6}\s*)?(?:\*{1,2})?(?:ENHANCED PROMPT|OPTIMIZED PROMPT|FINAL PROMPT|SYSTEM PROMPT|PROMPT)\s*(?:\([^)]*\)|\[[^\]]*\])?(?:\*{1,2})?:?\s*/i, '');

  // 2. Strip common preamble lines (e.g. "Here is the production-ready prompt:", "Enhanced Prompt:", etc.)
  text = text.replace(/^(?:Here is (?:the|your) [^\n:]+:|Below is [^\n:]+:)\s*[\r\n]*/i, '');

  // 3. Strip standalone production-ready, RTCEF, or meta header tags at the beginning
  text = text.replace(/^[\s\n]*\*{0,2}[\(\[]\s*(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|Optimized(?: Prompt)?|Enhanced(?: Prompt)?|Final(?: Output)?|System Prompt|Output Prompt|Draft|Version\s*\d+|v\d+)[^)\]]*[\)\]]\*{0,2}:?\s*[\r\n]*/i, '');
  text = text.replace(/^[\s\n]*\*{0,2}(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|RTCEF)\*{0,2}:?\s*[\r\n]*/i, '');

  // 4. Strip any leading standalone line that is purely in parentheses like "(Production-Ready):" or "(Version 3):"
  text = text.replace(/^[\s\n]*\([^\)]{1,60}\):?\s*[\r\n]*/i, '');

  // 5. Strip standalone meta header lines anywhere in the prompt body
  text = text.replace(/^[\t ]*\*{0,2}[\(\[]?\s*(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|RTCEF)\s*[\)\]]?\*{0,2}:?[\t ]*$/gim, '');

  // 6. Strip leading "> " or ">" markdown blockquote symbols across the whole prompt
  text = text.replace(/^[\t ]*>\s?/gm, '');

  // 7. Strip markdown bold and italic formatting cleanly
  text = text
    .replace(/\\([*_`])/g, '$1')
    .replace(/\*{2,}/g, '')
    .replace(/_{2,}/g, '')
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '$1');

  // 8. Strip lone leading asterisk on lines that are NOT bullet items
  text = text.replace(/^(\s*)\*(?![\s*])\s*/gm, '$1');

  // 9. Strip trailing lone asterisks at end of lines
  text = text.replace(/\*+\s*$/gm, '');

  if (text.includes('DIAGNOSED MODE:') || text.includes('DIAGNOSIS NOTES:')) {
    const actIdx = text.search(/(Act as|You are|Your task|System Prompt|# |\*\*Persona|\*\*Task)/i);
    if (actIdx !== -1) text = text.substring(actIdx).trim();
  }

  const handleCopyCode = async (codeText: string, index: number) => {
    await navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const renderInline = (str: string) => {
    // Strip any leading stray * or trailing stray *
    const s = str.replace(/^\*(?![\s*])/, '').replace(/\*+$/, '');
    const parts = s.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const inner = part.slice(1, -1).trim();
        if (!inner) return null;
        return (
          <code
            key={i}
            style={{
              background: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(124,58,237,0.08)',
              color: isDark ? '#C084FC' : '#6D28D9',
              padding: '1px 5px',
              borderRadius: '5px',
              fontSize: '0.9em',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            {inner}
          </code>
        );
      }
      return part.replace(/[*_`]/g, '');
    });
  };

  const isTableRow = (line: string) => /^\s*\|.+\|/.test(line);
  const isSeparatorRow = (line: string) => /^\s*\|[\s|:-]+\|\s*$/.test(line);
  const isPlaceholderRow = (cells: string[]) => cells.every((c) => !/[a-zA-Z0-9]/.test(c));

  const renderTable = (rows: string[], key: number) => {
    const nonSep = rows.filter((r) => !isSeparatorRow(r));
    const parsed = nonSep.map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    const [header, ...bodyRaw] = parsed;
    const body = bodyRaw.filter((row) => !isPlaceholderRow(row));

    return (
      <div
        key={key}
        style={{
          overflowX: 'auto',
          borderRadius: 10,
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : 'rgba(124,58,237,0.18)'}`,
          margin: '8px 0',
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 2px 10px rgba(124,58,237,0.06)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize }}>
          <thead>
            <tr
              style={{
                background: isDark
                  ? 'linear-gradient(135deg,rgba(139,92,246,0.22),rgba(167,139,250,0.1))'
                  : 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(167,139,250,0.05))',
              }}
            >
              {header?.map((cell, ci) => (
                <th
                  key={ci}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: fontSize - 0.5,
                    letterSpacing: '0.04em',
                    color: isDark ? '#C084FC' : '#5B21B6',
                    borderBottom: `2px solid ${isDark ? 'rgba(139,92,246,0.35)' : 'rgba(124,58,237,0.25)'}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr
                key={ri}
                style={{
                  background:
                    ri % 2 === 0
                      ? isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.7)'
                      : isDark
                      ? 'rgba(139,92,246,0.05)'
                      : 'rgba(124,58,237,0.03)',
                }}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '7px 12px',
                      color: isDark ? D.textPrimary : '#374151',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                      verticalAlign: 'top',
                      lineHeight: 1.5,
                    }}
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const SECTION_LABELS = [
    'ROLE', 'TASK', 'CONTEXT', 'EXAMPLES', 'FORMAT', 'CONSTRAINTS',
    'OUTPUT', 'INSTRUCTIONS', 'OBJECTIVE', 'GOAL', 'CRITERIA', 'AUDIENCE',
    'TONE', 'DOMAIN', 'ENHANCEMENT LEVEL', 'INPUT', 'STEPS', 'NOTES',
    'GUIDELINES', 'PARAMETERS', 'RULES', 'PERSONA', 'REQUIREMENTS', 'STRUCTURE',
  ];
  const sectionLabelRe = new RegExp(`^(${SECTION_LABELS.join('|')}):?\\s*(.*)$`, 'i');

  const renderSectionLabel = (label: string, rest: string, key: number, showCaret?: boolean) => (
    <div
      key={key}
      style={{
        display: 'flex',
        flexDirection: rest ? 'row' : 'column',
        alignItems: rest ? 'baseline' : 'flex-start',
        gap: 8,
        marginTop: 10,
        marginBottom: 2,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: isDark
            ? 'linear-gradient(135deg,rgba(139,92,246,0.28),rgba(167,139,250,0.12))'
            : 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(167,139,250,0.06))',
          border: `1px solid ${isDark ? 'rgba(167,139,250,0.35)' : 'rgba(124,58,237,0.25)'}`,
          color: isDark ? '#C084FC' : '#5B21B6',
          fontWeight: 800,
          fontSize: 9.5,
          letterSpacing: '0.08em',
          padding: '2px 8px',
          borderRadius: 16,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          textTransform: 'uppercase' as const,
        }}
      >
        {label.toUpperCase()}
      </span>
      {rest ? (
        <span style={{ color: isDark ? D.textPrimary : '#1E293B', fontSize: fontSize, lineHeight: 1.6 }}>
          {renderInline(rest)}
          {showCaret && <Caret />}
        </span>
      ) : (
        showCaret && <Caret />
      )}
    </div>
  );

  const blocks: { type: 'text' | 'code' | 'table'; content: string; language?: string; rows?: string[] }[] = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let textBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length > 0) {
      blocks.push({ type: 'text', content: textBuffer.join('\n') });
      textBuffer = [];
    }
  };
  const flushTable = () => {
    if (tableBuffer.length > 0) {
      blocks.push({ type: 'table', content: '', rows: [...tableBuffer] });
      tableBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/^[\t ]*>\s?/, '');
    const trimmed = line.trim();

    if (trimmed.startsWith('```') || (trimmed.startsWith('`') && inCode && trimmed === '`')) {
      if (inCode) {
        blocks.push({ type: 'code', content: codeBuffer.join('\n'), language: codeLang });
        codeBuffer = [];
        codeLang = '';
        inCode = false;
      } else {
        flushText();
        flushTable();
        inCode = true;
        codeLang = trimmed.replace(/^`+/, '').trim() || 'code';
      }
    } else if (inCode) {
      codeBuffer.push(line);
    } else if (isTableRow(line)) {
      flushText();
      tableBuffer.push(line);
    } else {
      flushTable();
      textBuffer.push(line);
    }
  }
  flushText();
  flushTable();
  if (codeBuffer.length > 0) {
    blocks.push({ type: 'code', content: codeBuffer.join('\n'), language: codeLang || 'code' });
  }

  if (blocks.length === 0 && isStreaming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 20 }}>
        <Caret />
      </div>
    );
  }

  const lastBlockIndex = blocks.length - 1;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        fontSize: fontSize,
        lineHeight: 1.6,
      }}
    >
      {blocks.map((block, bIdx) => {
        const isLastBlock = bIdx === lastBlockIndex;

        if (block.type === 'table') {
          const rows = block.rows ?? [];
          if (rows.some(isSeparatorRow) && rows.length >= 2) {
            return (
              <div key={bIdx}>
                {renderTable(rows, bIdx)}
                {isLastBlock && isStreaming && <Caret />}
              </div>
            );
          }
          return (
            <div key={bIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rows.map((r, i) => {
                const isLast = isLastBlock && isStreaming && i === rows.length - 1;
                return (
                  <p key={i} style={{ margin: 0, color: isDark ? D.textPrimary : '#1E293B', fontFamily: 'monospace', fontSize: fontSize }}>
                    {r}
                    {isLast && <Caret />}
                  </p>
                );
              })}
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <div
              key={bIdx}
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                background: '#0B0B12',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(124,58,237,0.15)'}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                margin: '6px 0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: isDark ? '#141320' : '#1E293B',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 10.5,
                  color: '#94A3B8',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CodeIcon size={12} style={{ color: '#A78BFA' }} />
                  <span style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {block.language}
                  </span>
                </div>
                <button
                  onClick={() => handleCopyCode(block.content, bIdx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 5,
                    padding: '3px 8px',
                    color: copiedCodeIndex === bIdx ? '#4ADE80' : '#E2E8F0',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {copiedCodeIndex === bIdx ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedCodeIndex === bIdx ? 'Copied' : 'Copy code'}</span>
                </button>
              </div>
              <pre
                style={{
                  padding: 12,
                  margin: 0,
                  overflowX: 'auto',
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  fontSize: fontSize,
                  lineHeight: 1.5,
                  color: '#F8FAFC',
                  background: 'transparent',
                }}
              >
                <code>{block.content}</code>
                {isLastBlock && isStreaming && <Caret />}
              </pre>
            </div>
          );
        }

        const paragraphLines = block.content.split('\n');
        let lastValidLineIdx = -1;
        for (let idx = paragraphLines.length - 1; idx >= 0; idx--) {
          const t = paragraphLines[idx].trim();
          if (t && /[a-zA-Z0-9]/.test(t)) {
            lastValidLineIdx = idx;
            break;
          }
        }

        return (
          <div key={bIdx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paragraphLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;

              // Filter noise
              if (!/[a-zA-Z0-9]/.test(trimmed)) return null;

              // Filter placeholder bullet lines
              if (/^([-*+•·]|\d+[\.\)])\s*[^a-zA-Z0-9]*$/.test(trimmed)) return null;

              // Filter standalone meta labels
              if (/^\(?(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|RTCEF)\)?:?$/i.test(trimmed)) return null;

              const isLastLine = isLastBlock && isStreaming && (lIdx === lastValidLineIdx || (lastValidLineIdx === -1 && lIdx === paragraphLines.length - 1));

              // Section badge labels (ROLE:, TASK:, CONTEXT:, etc.)
              const slMatch = trimmed.match(sectionLabelRe);
              if (slMatch) return renderSectionLabel(slMatch[1], slMatch[2] ?? '', lIdx, isLastLine);

              // Headings (# Heading)
              const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
              if (headingMatch) {
                const lvl = headingMatch[1].length;
                return (
                  <div
                    key={lIdx}
                    style={{
                      fontSize: lvl <= 2 ? 15 : lvl <= 4 ? 13.5 : 12.5,
                      fontWeight: 700,
                      color:
                        lvl <= 2
                          ? isDark
                            ? '#F5F4F8'
                            : '#1E1B4B'
                          : lvl <= 4
                          ? isDark
                            ? '#C084FC'
                            : '#4C1D95'
                          : isDark
                          ? '#A78BFA'
                          : '#6D28D9',
                      margin: '8px 0 2px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {renderInline(headingMatch[2])}
                    {isLastLine && <Caret />}
                  </div>
                );
              }

              // Bullet points (- item, * item, + item, • item, · item)
              const bulletMatch = trimmed.match(/^([-*+•·])\s+(.*)$/);
              if (bulletMatch) {
                const cleaned = bulletMatch[2].trim();
                if (!cleaned || !/[a-zA-Z0-9]/.test(cleaned)) return null;
                return (
                  <div key={lIdx} style={{ display: 'flex', gap: 8, paddingLeft: 6, alignItems: 'flex-start' }}>
                    <span style={{ color: isDark ? '#A78BFA' : '#7C3AED', fontWeight: 800, fontSize: 13, lineHeight: '16px', flexShrink: 0 }}>•</span>
                    <div style={{ color: isDark ? D.textPrimary : '#1E293B', flex: 1 }}>
                      {renderInline(cleaned)}
                      {isLastLine && <Caret />}
                    </div>
                  </div>
                );
              }

              // Numbered list items (1. item, 1) item, (1) item)
              const numMatch = trimmed.match(/^(?:\(?(\d+)[\.\)]|\b(\d+)\.)\s+(.*)$/);
              if (numMatch) {
                const num = numMatch[1] || numMatch[2];
                const cleaned = numMatch[3].trim();
                if (!cleaned || !/[a-zA-Z0-9]/.test(cleaned)) return null;
                return (
                  <div key={lIdx} style={{ display: 'flex', gap: 8, paddingLeft: 4, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        background: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(124,58,237,0.1)',
                        color: isDark ? '#C084FC' : '#6D28D9',
                        fontWeight: 700,
                        fontSize: 9.5,
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {num}
                    </span>
                    <div style={{ color: isDark ? D.textPrimary : '#1E293B', flex: 1 }}>
                      {renderInline(cleaned)}
                      {isLastLine && <Caret />}
                    </div>
                  </div>
                );
              }

              // Standard paragraph line
              return (
                <p key={lIdx} style={{ margin: 0, color: isDark ? D.textPrimary : '#1E293B' }}>
                  {renderInline(trimmed)}
                  {isLastLine && <Caret />}
                </p>
              );
            })}
            {isLastBlock && isStreaming && lastValidLineIdx === -1 && <Caret />}
          </div>
        );
      })}
    </div>
  );
};

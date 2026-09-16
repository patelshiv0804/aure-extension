// ──────────────────────────────────────────────────────────────
// Prompt Text Formatter & Artifact Cleaner
// Ported from Prompt_Enhancer-FE (FormattedPromptViewer.tsx & ComparisonBlock.tsx)
// Strips LLM meta markers, preambles, blockquotes, raw markdown artifacts (**, *"", ---)
// ──────────────────────────────────────────────────────────────

/**
 * Format and sanitize prompt text coming from backend LLM models.
 * Operates on both streamed token buffers and final completed prompts.
 * Completely suppresses and strips internal diagnosis notes (DIAGNOSED MODE,
 * DIAGNOSIS NOTES, etc.) so only the actual enhanced prompt is streamed and displayed.
 */
export function formatPromptText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();
  if (!cleaned) return '';

  // 1. Check if the text contains an internal diagnosis block
  const hasDiagnosisBlock =
    /(?:DIAGNOSED|DIAGNOSIS|INTERNAL DIAGNOSIS|SECONDARY COLLISION|STEP 1\b|Internal diagnosis)/i.test(cleaned);

  if (hasDiagnosisBlock) {
    // Look for where the actual enhanced prompt begins.
    // Matches: ENHANCED PROMPT, or on a new line: Role:, Task:, Persona:, Objective:, Context:, Act as, You are, Your task, System Prompt, etc.
    const promptStartRegex =
      /(?:(?:#{1,6}\s*)?(?:\*{1,2})?(?:ENHANCED PROMPT|OPTIMIZED PROMPT|FINAL PROMPT|SYSTEM PROMPT|STEP 2[ —\-]+Write|STEP 3[ —\-]+Output)\s*(?:\([^)]*\)|\[[^\]]*\])?(?:\*{1,2})?:?|(?:^|\n)[ \t]*(?:\*{1,2})?(?:Role|Task|Persona|Objective|Context|System Instructions|Instructions)\s*(?:\*{1,2})?:|(?:^|\n)[ \t]*(?:Act as\b|You are\b|Your task\b|System Prompt\b))/i;

    const match = promptStartRegex.exec(cleaned);
    if (!match) {
      // The model is still emitting the internal diagnosis block — do not display anything in the chat box yet!
      return '';
    }

    let startIndex = match.index;
    const matchedText = match[0];

    // If the match was a section header like "ENHANCED PROMPT:", skip past the header
    if (/ENHANCED PROMPT|OPTIMIZED PROMPT|FINAL PROMPT|SYSTEM PROMPT/i.test(matchedText)) {
      startIndex += matchedText.length;
    } else {
      // For "Role:", "Task:", "Act as", etc., keep it (skip any leading newlines/spaces)
      const leadingWhitespace = matchedText.match(/^\s+/);
      if (leadingWhitespace) {
        startIndex += leadingWhitespace[0].length;
      }
    }

    cleaned = cleaned.substring(startIndex).trim();
  }

  // If after stripping diagnosis the text is empty, return empty
  if (!cleaned) return '';

  // 2. Strip trailing auxiliary sections (e.g. "WHY THIS VERSION IS STRONGER", "Why it's stronger")
  const trailingWhyRegex =
    /(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2})?(?:why\s+this\s+version\s+is\s+stronger|why\s+it['’]?s\s+stronger|rationale|improvements\s+made)[\s\S]*$/i;
  cleaned = cleaned.replace(trailingWhyRegex, '').trim();

  // 3. Strip leading LLM meta markers like "ENHANCED PROMPT (Production-Ready):", "ENHANCED PROMPT:", etc.
  cleaned = cleaned.replace(
    /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:ENHANCED PROMPT|OPTIMIZED PROMPT|FINAL PROMPT|SYSTEM PROMPT|PROMPT)\s*(?:\([^)]*\)|\[[^\]]*\])?(?:\*{1,2})?:?\s*/i,
    ''
  );

  // 4. Strip common preamble lines (e.g. "Here is the production-ready prompt:", "Enhanced Prompt:", etc.)
  cleaned = cleaned.replace(/^(?:Here is (?:the|your) [^\n:]+:|Below is [^\n:]+:)\s*[\r\n]*/i, '');

  // 5. Strip standalone production-ready, RTCEF, or meta header tags at the beginning
  cleaned = cleaned.replace(
    /^[\s\n]*\*{0,2}[\(\[]\s*(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|Optimized(?: Prompt)?|Enhanced(?: Prompt)?|Final(?: Output)?|System Prompt|Output Prompt|Draft|Version\s*\d+|v\d+)[^)\]]*[\)\]]\*{0,2}:?\s*[\r\n]*/i,
    ''
  );
  cleaned = cleaned.replace(
    /^[\s\n]*\*{0,2}(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|RTCEF)\*{0,2}:?\s*[\r\n]*/i,
    ''
  );

  // 6. Strip any leading standalone line in parentheses like "(Production-Ready):" or "(Version 3):"
  cleaned = cleaned.replace(/^[\s\n]*\([^\)]{1,60}\):?\s*[\r\n]*/i, '');

  // 7. Strip standalone meta header lines anywhere in the prompt body
  cleaned = cleaned.replace(
    /^[\t ]*\*{0,2}[\(\[]?\s*(?:Production[- ]Ready|Production[- ]Grade|RTCEF(?: Framework)?|RTCEF)\s*[\)\]]?\*{0,2}:?[\t ]*$/gim,
    ''
  );

  // 8. Strip leading blockquote symbols ("> " or ">") across the whole prompt
  cleaned = cleaned.replace(/^[\t ]*>\s?/gm, '');

  // 9. Remove code block wrappers (e.g. ```markdown ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:markdown|text|json|yaml|)\s*\n/gi, '');
  cleaned = cleaned.replace(/\n```\s*$/g, '');
  cleaned = cleaned.replace(/```/g, '');

  // 10. Remove horizontal divider lines (e.g. -----------------, ***, ____, ===)
  cleaned = cleaned.replace(/^[ \t]*[-*_=]{3,}[ \t]*$/gm, '');

  // 11. Clean markdown bold and italic formatting cleanly
  cleaned = cleaned
    .replace(/\\([*_`])/g, '$1')
    .replace(/\*{2,}/g, '')
    .replace(/_{2,}/g, '')
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '$1');

  // 12. Remove quoted-star artifacts: *"text"* -> "text", _"text"_ -> "text"
  cleaned = cleaned.replace(/\*"(.*?)"\*/g, '"$1"');
  cleaned = cleaned.replace(/_"(.*?)"_/g, '"$1"');

  // 13. Strip lone leading asterisk on lines that are NOT bullet items (e.g. `*"Generate a prompt...`)
  cleaned = cleaned.replace(/^(\s*)\*(?![\s*])\s*/gm, '$1');

  // 14. Strip trailing lone asterisks at end of lines
  cleaned = cleaned.replace(/\*+\s*$/gm, '');

  // 15. Remove header markdown symbols: ### Header Title -> Header Title
  cleaned = cleaned.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');

  // 16. Clean up list item bullets (e.g. "  * Item" -> "- Item")
  cleaned = cleaned.replace(/^[ \t]*[*•][ \t]+/gm, '- ');

  // 17. Collapse 3+ consecutive newlines into clean double newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}



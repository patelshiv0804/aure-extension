// ──────────────────────────────────────────────────────────────
// Prompt Text Formatter & Artifact Cleaner
// Efficiently cleans raw LLM response markdown artifacts (**, *"", ---)
// ──────────────────────────────────────────────────────────────

/**
 * Format and sanitize raw prompt text coming from backend LLM models.
 * Strips raw markdown clutter like bold asterisks (`**`), quote stars (`*"`),
 * horizontal dividers (`-----------------`), code blocks, and excessive line breaks.
 */
export function formatPromptText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Remove code block wrappers (e.g. ```markdown ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:markdown|text|json|yaml|)\s*\n/gi, '');
  cleaned = cleaned.replace(/\n```\s*$/g, '');
  cleaned = cleaned.replace(/```/g, '');

  // 2. Remove horizontal divider lines (e.g. -----------------, ***, ____, ===)
  cleaned = cleaned.replace(/^[ \t]*[-*_=]{3,}[ \t]*$/gm, '');

  // 3. Remove bold asterisks and underscores: **word** -> word, __word__ -> word
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');

  // 4. Remove quoted-star or italic-star artifacts: *"text"* -> "text", *text* -> text
  cleaned = cleaned.replace(/\*"(.*?)"\*/g, '"$1"');
  cleaned = cleaned.replace(/_"(.*?)"_/g, '"$1"');
  cleaned = cleaned.replace(/(?<=\s|^|\()\*(?!\s)([^*]+?)\*(?=\s|$|\.|\,)/g, '$1');

  // 5. Remove header markdown symbols: ### Header Title -> Header Title
  cleaned = cleaned.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');

  // 6. Clean up list item bullets (e.g. "  * Item" -> "- Item")
  cleaned = cleaned.replace(/^[ \t]*[*•][ \t]+/gm, '- ');

  // 7. Collapse 3+ consecutive newlines into clean double newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

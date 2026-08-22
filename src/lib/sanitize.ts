// ──────────────────────────────────────────────────────────────
// Input Sanitization using DOMPurify
// ──────────────────────────────────────────────────────────────

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div', 'code', 'pre'],
    // 'style' is intentionally excluded: inline styles enable CSS-based data
    // exfiltration / UI-redressing injections (AURE-09). Styling comes from
    // the extension's own classes via ALLOWED_ATTR: ['class'].
    ALLOWED_ATTR: ['class'],
  });
}

/**
 * Sanitize plain text — strip all HTML tags.
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize user input for API requests — prevent injection.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Strip angle brackets
    .trim()
    .slice(0, 50_000); // Hard limit: 50K chars
}

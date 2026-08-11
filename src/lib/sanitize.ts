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
    ALLOWED_ATTR: ['class', 'style'],
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

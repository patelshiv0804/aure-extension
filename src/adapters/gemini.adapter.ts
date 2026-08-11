// ──────────────────────────────────────────────────────────────
// Gemini Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'Gemini',
  hostnames: ['gemini.google.com'],
  selectors: [
    'div.ql-editor[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    '.text-input-area div[contenteditable="true"]',
  ],
  inputType: 'contenteditable',
  injectMethod: 'execCommand',
  containerSelector: 'body',
  icon: '🔵',
};

export class GeminiAdapter extends BaseAdapter {
  readonly name = 'Gemini';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '🔵';

  constructor() {
    super(CONFIG);
  }

  /**
   * Gemini may use a Quill-based editor inside web components.
   * Override detection to traverse shadow DOM.
   */
  detectInput(): HTMLElement | null {
    // First try standard detection
    const standard = super.detectInput();
    if (standard) return standard;

    // Try traversing shadow DOM for rich-textarea
    try {
      const richTextarea = document.querySelector('rich-textarea');
      if (richTextarea?.shadowRoot) {
        const inner = richTextarea.shadowRoot.querySelector<HTMLElement>(
          'div[contenteditable="true"]'
        );
        if (inner && this.isVisible(inner)) {
          this.currentInput = inner;
          return inner;
        }
      }
    } catch {
      // Shadow DOM traversal failed
    }

    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// Microsoft Copilot Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'Copilot',
  hostnames: ['copilot.microsoft.com'],
  selectors: [
    'textarea[id*="searchbox"]',
    'textarea[placeholder]',
    '#searchbox',
  ],
  inputType: 'textarea',
  injectMethod: 'react-synthetic',
  containerSelector: 'main',
  icon: '🪟',
};

export class CopilotAdapter extends BaseAdapter {
  readonly name = 'Copilot';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '🪟';

  constructor() {
    super(CONFIG);
  }

  /**
   * Copilot may use web components (cib-serp) with Shadow DOM.
   */
  detectInput(): HTMLElement | null {
    const standard = super.detectInput();
    if (standard) return standard;

    // Try traversing Copilot's web component shadow DOM
    try {
      const cibSerp = document.querySelector('cib-serp');
      if (cibSerp?.shadowRoot) {
        const actionBar = cibSerp.shadowRoot.querySelector('cib-action-bar');
        if (actionBar?.shadowRoot) {
          const textarea = actionBar.shadowRoot.querySelector<HTMLTextAreaElement>('textarea');
          if (textarea) {
            this.currentInput = textarea;
            return textarea;
          }
        }
      }
    } catch {
      // Shadow DOM traversal failed
    }

    return null;
  }
}

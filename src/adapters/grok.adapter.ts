// ──────────────────────────────────────────────────────────────
// Grok Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'Grok',
  hostnames: ['x.com', 'grok.com'],
  selectors: [
    'textarea[placeholder]',
    'div[role="textbox"]',
    'div[contenteditable="true"]',
  ],
  inputType: 'textarea',
  injectMethod: 'react-synthetic',
  containerSelector: 'main',
  icon: '⚡',
};

export class GrokAdapter extends BaseAdapter {
  readonly name = 'Grok';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '⚡';

  constructor() {
    super(CONFIG);
  }

  /**
   * Grok on x.com uses a specific URL path.
   * Only activate when on /i/grok path or grok.com.
   */
  detectInput(): HTMLElement | null {
    const hostname = window.location.hostname;
    if (hostname.includes('x.com') && !window.location.pathname.startsWith('/i/grok')) {
      return null; // Only activate on Grok path within x.com
    }
    return super.detectInput();
  }
}

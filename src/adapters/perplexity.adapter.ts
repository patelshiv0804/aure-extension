// ──────────────────────────────────────────────────────────────
// Perplexity Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'Perplexity',
  hostnames: ['www.perplexity.ai', 'perplexity.ai'],
  selectors: [
    'textarea[placeholder]',
    'textarea[autofocus]',
    'div[contenteditable="true"]',
  ],
  inputType: 'textarea',
  injectMethod: 'react-synthetic',
  containerSelector: 'main',
  icon: '🔍',
};

export class PerplexityAdapter extends BaseAdapter {
  readonly name = 'Perplexity';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '🔍';

  constructor() {
    super(CONFIG);
  }
}

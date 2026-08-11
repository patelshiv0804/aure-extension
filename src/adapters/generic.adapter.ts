// ──────────────────────────────────────────────────────────────
// Generic Adapter — Fallback for custom/unknown sites
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const DEFAULT_CONFIG: SiteConfig = {
  name: 'Generic',
  hostnames: [],
  selectors: [
    'textarea[placeholder]',
    'div[role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
  inputType: 'textarea',
  injectMethod: 'react-synthetic',
  containerSelector: 'body',
  icon: '🌐',
};

export class GenericAdapter extends BaseAdapter {
  readonly name: string;
  readonly hostnames: string[];
  readonly icon = '🌐';

  constructor(customConfig?: Partial<SiteConfig>) {
    const config = { ...DEFAULT_CONFIG, ...customConfig };
    super(config);
    this.name = config.name;
    this.hostnames = config.hostnames;
  }
}

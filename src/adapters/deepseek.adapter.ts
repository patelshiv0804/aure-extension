// ──────────────────────────────────────────────────────────────
// DeepSeek Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'DeepSeek',
  hostnames: ['chat.deepseek.com'],
  selectors: [
    'textarea#chat-input',
    'textarea[placeholder]',
    'div[contenteditable="true"]',
  ],
  inputType: 'textarea',
  injectMethod: 'react-synthetic',
  containerSelector: 'main',
  icon: '🐋',
};

export class DeepSeekAdapter extends BaseAdapter {
  readonly name = 'DeepSeek';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '🐋';

  constructor() {
    super(CONFIG);
  }
}

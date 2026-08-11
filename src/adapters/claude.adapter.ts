// ──────────────────────────────────────────────────────────────
// Claude Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'Claude',
  hostnames: ['claude.ai'],
  selectors: [
    'div.ProseMirror[contenteditable="true"]',
    'fieldset textarea',
    'div[contenteditable="true"][translate="no"]',
    'div[contenteditable="true"][role="textbox"]',
  ],
  inputType: 'contenteditable',
  injectMethod: 'execCommand',
  containerSelector: 'main',
  icon: '🟤',
};

export class ClaudeAdapter extends BaseAdapter {
  readonly name = 'Claude';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '🟤';

  constructor() {
    super(CONFIG);
  }

  /**
   * Claude uses ProseMirror editor — uses execCommand for injection.
   */
  async injectPrompt(text: string): Promise<void> {
    const input = this.currentInput ?? this.detectInput();
    if (!input) throw new Error('Claude input not found');

    input.focus();
    await new Promise((r) => setTimeout(r, 50));

    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Delete and insert
    document.execCommand('delete');
    document.execCommand('insertText', false, text);

    // ProseMirror needs the input event
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }));
  }
}

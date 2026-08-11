// ──────────────────────────────────────────────────────────────
// ChatGPT Adapter
// ──────────────────────────────────────────────────────────────

import { BaseAdapter } from './base-adapter';
import type { SiteConfig } from '@/types/adapter';

const CONFIG: SiteConfig = {
  name: 'ChatGPT',
  hostnames: ['chat.openai.com', 'chatgpt.com'],
  selectors: [
    '#prompt-textarea',
    'div[contenteditable="true"][data-placeholder]',
    'textarea[data-id]',
    'div[contenteditable="true"][role="textbox"]',
  ],
  inputType: 'contenteditable',
  injectMethod: 'react-synthetic',
  containerSelector: 'main',
  icon: '🟢',
};

export class ChatGPTAdapter extends BaseAdapter {
  readonly name = 'ChatGPT';
  readonly hostnames = CONFIG.hostnames;
  readonly icon = '🟢';

  constructor() {
    super(CONFIG);
  }

  /**
   * ChatGPT uses a contenteditable div with React state management.
   * Override extractPrompt to handle the ProseMirror-like structure.
   */
  extractPrompt(): string {
    const input = this.currentInput ?? this.detectInput();
    if (!input) return '';

    // ChatGPT uses contenteditable <div> with <p> children
    if (input.getAttribute('contenteditable') === 'true') {
      return input.innerText?.trim() ?? '';
    }

    // Fallback for textarea variant
    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    }

    return input.textContent?.trim() ?? '';
  }

  /**
   * ChatGPT specific injection — handles React's controlled state.
   */
  async injectPrompt(text: string): Promise<void> {
    const input = this.currentInput ?? this.detectInput();
    if (!input) throw new Error('ChatGPT input not found');

    input.focus();
    await new Promise((r) => setTimeout(r, 50));

    if (input.getAttribute('contenteditable') === 'true') {
      // Clear existing content
      input.innerHTML = '';
      // Create a paragraph element (ChatGPT expects <p> elements)
      const p = document.createElement('p');
      p.textContent = text;
      input.appendChild(p);
      // Dispatch events to notify React
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    } else {
      await this.injectReactSynthetic(input, text);
    }
  }
}

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
   * ChatGPT specific injection — handles React & ProseMirror controlled state.
   * Uses execCommand('selectAll') + execCommand('insertText') to avoid
   * clearing innerHTML (which breaks MutationObserver and the floating badge).
   */
  async injectPrompt(text: string): Promise<void> {
    // Detect live input element
    let input = this.detectInput();
    if (!input || !input.isConnected) {
      input = document.querySelector<HTMLElement>(
        '#prompt-textarea, div[contenteditable="true"][data-placeholder], textarea[data-id], div[contenteditable="true"][role="textbox"]'
      );
    }

    if (!input) throw new Error('ChatGPT input not found');
    this.currentInput = input;

    // Focus & scroll into view
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await new Promise((r) => setTimeout(r, 60));

    // Handle HTMLTextAreaElement / HTMLInputElement (rare on ChatGPT)
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input),
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(input, text);
      } else {
        input.value = text;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Handle ContentEditable div (ChatGPT ProseMirror / Lexical)
    // IMPORTANT: Do NOT clear innerHTML — that breaks the floating badge by
    // triggering MutationObserver. Instead use execCommand to replace content.
    if (input.getAttribute('contenteditable') === 'true' || input.isContentEditable) {
      input.focus();

      // Step 1: Select all existing content
      document.execCommand('selectAll', false);
      await new Promise((r) => setTimeout(r, 20));

      // Step 2: Insert new text (replaces selection, preserves React state)
      const inserted = document.execCommand('insertText', false, text);

      if (!inserted) {
        // Fallback if execCommand is blocked: use keyboard event sequence
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('insertText', false, text);
      }

      // Dispatch event sequence for React/ProseMirror listeners
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        })
      );
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        })
      );
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    await this.injectReactSynthetic(input, text);
  }
}

// ──────────────────────────────────────────────────────────────
// Base Adapter — Abstract class with shared MutationObserver logic
// ──────────────────────────────────────────────────────────────

import type { SiteAdapter, SiteConfig, InjectMethod } from '@/types/adapter';
import { debounce } from '@/lib/debounce';

export abstract class BaseAdapter implements SiteAdapter {
  abstract readonly name: string;
  abstract readonly hostnames: string[];
  abstract readonly icon: string;

  protected config: SiteConfig;
  protected observer: MutationObserver | null = null;
  protected currentInput: HTMLElement | null = null;
  protected urlCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastUrl = '';

  constructor(config: SiteConfig) {
    this.config = config;
  }

  /**
   * Detect the prompt input element using configured selectors.
   */
  detectInput(): HTMLElement | null {
    if (this.currentInput && this.currentInput.isConnected && this.isVisible(this.currentInput)) {
      return this.currentInput;
    }

    // Clear stale ref
    this.currentInput = null;

    for (const selector of this.config.selectors) {
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (el && el.isConnected && this.isVisible(el)) {
          this.currentInput = el;
          return el;
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return null;
  }

  /**
   * Extract prompt text from the detected input.
   */
  extractPrompt(): string {
    const input = this.currentInput ?? this.detectInput();
    if (!input) return '';

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      return input.value;
    }

    // contenteditable — get innerText (preserves line breaks)
    return input.innerText?.trim() ?? '';
  }

  /**
   * Inject enhanced prompt text into the input field.
   * Uses the configured injection method for framework compatibility.
   */
  async injectPrompt(text: string): Promise<void> {
    const input = this.currentInput ?? this.detectInput();
    if (!input) throw new Error('No input element found');

    // Focus the input first
    input.focus();

    // Small delay to ensure focus is registered
    await sleep(50);

    switch (this.config.injectMethod) {
      case 'react-synthetic':
        await this.injectReactSynthetic(input, text);
        break;
      case 'execCommand':
        this.injectExecCommand(input, text);
        break;
      case 'value-set':
        this.injectValueSet(input, text);
        break;
      case 'clipboard':
        await this.injectClipboard(input, text);
        break;
      default:
        // Fallback: try multiple methods
        await this.injectFallback(input, text);
    }
  }

  /**
   * Start observing the DOM for input field changes.
   * Handles SPA navigation, dynamic rendering, and page refresh.
   */
  observeChanges(callback: (input: HTMLElement) => void): void {
    this.disconnect();

    const debouncedDetect = debounce(() => {
      const input = this.detectInput();
      if (input) {
        callback(input);
      }
    }, 50);

    // MutationObserver for dynamically added input elements
    this.observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
        if (mutation.type === 'attributes') {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) {
        debouncedDetect();
      }
    });

    // Observe the container or body
    const container = this.config.containerSelector
      ? document.querySelector(this.config.containerSelector) ?? document.body
      : document.body;

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    });

    // SPA navigation detection (URL changes without page reload)
    this.lastUrl = location.href;
    this.urlCheckInterval = setInterval(() => {
      if (location.href !== this.lastUrl) {
        this.lastUrl = location.href;
        // Re-detect after SPA navigation
        setTimeout(() => debouncedDetect(), 500);
      }
    }, 1000);

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => debouncedDetect(), 500);
    });

    // Initial detection
    debouncedDetect();
  }

  /**
   * Stop observing DOM changes.
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
  }

  /**
   * Get the bounding rect of the current input for UI positioning.
   */
  getInputRect(): DOMRect | null {
    const input = this.currentInput ?? this.detectInput();
    return input?.getBoundingClientRect() ?? null;
  }

  /**
   * Determine the platform name from hostname.
   */
  getPlatformName(): string {
    return this.name;
  }

  // ── Protected Injection Methods ───────────────────────────

  /**
   * Inject into React-managed inputs by dispatching synthetic InputEvent.
   * Required for ChatGPT, Perplexity, etc. that use controlled components.
   */
  protected async injectReactSynthetic(el: HTMLElement, text: string): Promise<void> {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      // For React controlled inputs, we need to use the native value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // contenteditable
      this.clearContentEditable(el);
      await sleep(10);
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }

  /**
   * Inject using document.execCommand — works for ProseMirror (Claude), Quill (Gemini).
   */
  protected injectExecCommand(el: HTMLElement, text: string): void {
    el.focus();
    this.clearContentEditable(el);
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  }

  /**
   * Simple value setter — for standard inputs without React.
   */
  protected injectValueSet(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Clipboard-based injection — last resort fallback.
   */
  protected async injectClipboard(el: HTMLElement, text: string): Promise<void> {
    el.focus();
    this.clearContentEditable(el);
    try {
      await navigator.clipboard.writeText(text);
      document.execCommand('paste');
    } catch {
      // Fallback to execCommand insertText
      document.execCommand('insertText', false, text);
    }
  }

  /**
   * Try multiple injection methods as fallback.
   */
  protected async injectFallback(el: HTMLElement, text: string): Promise<void> {
    try {
      await this.injectReactSynthetic(el, text);
      return;
    } catch { /* try next */ }

    try {
      this.injectExecCommand(el, text);
      return;
    } catch { /* try next */ }

    this.injectValueSet(el, text);
  }

  // ── Helpers ───────────────────────────────────────────────

  private clearContentEditable(el: HTMLElement): void {
    // Select all content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Delete selected content
    document.execCommand('delete');
  }

  protected isVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

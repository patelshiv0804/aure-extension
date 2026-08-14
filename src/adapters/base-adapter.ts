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
  private popstateHandler: (() => void) | null = null;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  /**
   * Detect the prompt input element using configured selectors.
   */
  detectInput(): HTMLElement | null {
    // Validate cached input is still connected, visible and non-zero sized
    if (this.currentInput) {
      const rect = this.currentInput.getBoundingClientRect();
      if (
        this.currentInput.isConnected &&
        this.isVisible(this.currentInput) &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        return this.currentInput;
      }
      // Cache is stale — clear it so we re-detect below
      this.currentInput = null;
    }

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

    // Track last reported input to avoid calling callback repeatedly for same element
    let lastReportedInput: HTMLElement | null = null;

    const tryDetect = () => {
      const input = this.detectInput();
      if (input && input !== lastReportedInput) {
        lastReportedInput = input;
        callback(input);
        // Input found — but keep observer running so we detect
        // input replacement on SPA navigation or re-render.
      }
    };

    // Debounce at 200ms to avoid hammering during streaming / rapid DOM mutations
    const debouncedDetect = debounce(tryDetect, 200);

    // ── Instant first pass (synchronous, no delay) ────────────────────────────
    tryDetect();

    // ── Tight progressive retry: catches input within 50–800ms of page load ──
    // Short delays ensure button appears immediately without any user interaction.
    [50, 150, 400, 800, 1500].forEach((delay) => setTimeout(tryDetect, delay));

    // MutationObserver — only watch childList, no attribute observation.
    // Attribute changes (class, style) fire hundreds of times per second
    // during ChatGPT streaming and cause severe scroll lag.
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          debouncedDetect();
          return;
        }
      }
    });

    // Observe the container or body — childList+subtree only, no attributes
    const container = this.config.containerSelector
      ? document.querySelector(this.config.containerSelector) ?? document.body
      : document.body;

    this.observer.observe(container, {
      childList: true,
      subtree: true,
    });

    // ── SPA navigation detection via pushState/replaceState hooks ─────────────
    // Replaces the 500ms setInterval poll with zero-cost event hooks.
    this.lastUrl = location.href;
    const onNavigate = () => {
      const newUrl = location.href;
      if (newUrl !== this.lastUrl) {
        this.lastUrl = newUrl;
        this.currentInput = null;
        lastReportedInput = null;
        // Re-attach observer for new page
        if (this.observer) {
          try { this.observer.observe(container, { childList: true, subtree: true }); } catch {}
        }
        [0, 100, 300, 700].forEach((delay) => setTimeout(tryDetect, delay));
      }
    };

    // Patch history methods to detect SPA pushState navigation
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);
    (history as any).pushState = function(...args: Parameters<typeof history.pushState>) {
      origPushState(...args);
      onNavigate();
    };
    (history as any).replaceState = function(...args: Parameters<typeof history.replaceState>) {
      origReplaceState(...args);
      onNavigate();
    };

    // Listen for popstate (back/forward navigation)
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }
    this.popstateHandler = () => {
      this.currentInput = null;
      lastReportedInput = null;
      if (this.observer) {
        try { this.observer.observe(container, { childList: true, subtree: true }); } catch {}
      }
      [0, 100, 300, 700].forEach((delay) => setTimeout(tryDetect, delay));
    };
    window.addEventListener('popstate', this.popstateHandler);

    // Store restore functions for disconnect()
    (this as any)._origPushState = origPushState;
    (this as any)._origReplaceState = origReplaceState;
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
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    // Restore patched history methods if we replaced them
    if ((this as any)._origPushState) {
      history.pushState = (this as any)._origPushState;
      (this as any)._origPushState = null;
    }
    if ((this as any)._origReplaceState) {
      history.replaceState = (this as any)._origReplaceState;
      (this as any)._origReplaceState = null;
    }
    this.currentInput = null;
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
    return rect.width > 0 && rect.height > 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

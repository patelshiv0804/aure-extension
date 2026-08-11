// ──────────────────────────────────────────────────────────────
// Adapter Types
// ──────────────────────────────────────────────────────────────

export type InputType = 'textarea' | 'contenteditable' | 'input';
export type InjectMethod = 'react-synthetic' | 'execCommand' | 'value-set' | 'clipboard';

export interface SiteAdapter {
  readonly name: string;
  readonly hostnames: string[];
  readonly icon: string;

  /** Detect and return the active prompt input element */
  detectInput(): HTMLElement | null;

  /** Extract the current prompt text from the input */
  extractPrompt(): string;

  /** Inject enhanced prompt text into the input field */
  injectPrompt(text: string): Promise<void>;

  /** Start observing DOM mutations for input field changes */
  observeChanges(callback: (input: HTMLElement) => void): void;

  /** Stop observing */
  disconnect(): void;

  /** Get the bounding rect of the input for UI positioning */
  getInputRect(): DOMRect | null;

  /** Determine the current platform model name */
  getPlatformName(): string;
}

export interface SiteConfig {
  name: string;
  hostnames: string[];
  selectors: string[];
  inputType: InputType;
  injectMethod: InjectMethod;
  containerSelector?: string;
  icon?: string;
}

export interface SelectorRegistry {
  [key: string]: SiteConfig;
}

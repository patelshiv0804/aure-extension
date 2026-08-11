// ──────────────────────────────────────────────────────────────
// Keyboard Shortcut Definitions
// ──────────────────────────────────────────────────────────────

export interface ShortcutDefinition {
  id: string;
  keys: string;
  label: string;
  description: string;
  context: 'content' | 'global';
}

export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'enhance',
    keys: 'Alt+E',
    label: 'Enhance',
    description: 'Enhance current prompt',
    context: 'content',
  },
  {
    id: 'change-mode',
    keys: 'Alt+M',
    label: 'Change Mode',
    description: 'Open enhancement mode selector',
    context: 'content',
  },
  {
    id: 'history',
    keys: 'Alt+H',
    label: 'History',
    description: 'Open prompt history',
    context: 'global',
  },
  {
    id: 'recommendation',
    keys: 'Alt+R',
    label: 'Recommend',
    description: 'Show AI model recommendation',
    context: 'content',
  },
  {
    id: 'versions',
    keys: 'Alt+V',
    label: 'Versions',
    description: 'Show prompt versions',
    context: 'content',
  },
  {
    id: 'compare',
    keys: 'Alt+C',
    label: 'Compare',
    description: 'Toggle comparison panel',
    context: 'content',
  },
  {
    id: 'close',
    keys: 'Escape',
    label: 'Close',
    description: 'Close any open panel',
    context: 'content',
  },
];

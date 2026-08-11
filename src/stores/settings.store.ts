// ──────────────────────────────────────────────────────────────
// Settings Store — Zustand + chrome.storage.sync
// ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { ExtensionSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState {
  settings: ExtensionSettings;
  isLoaded: boolean;
  setSettings: (settings: ExtensionSettings) => void;
  updateSettings: (partial: Partial<ExtensionSettings>) => void;
  resetSettings: () => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,

  setSettings: (settings) => {
    set({ settings, isLoaded: true });
    // Persist to chrome.storage
    chrome.storage.local.set({ settings }).catch(console.error);
  },

  updateSettings: (partial) => {
    const current = get().settings;
    const updated = deepMergeSettings(current, partial);
    set({ settings: updated });
    chrome.storage.local.set({ settings: updated }).catch(console.error);
  },

  resetSettings: () => {
    set({ settings: DEFAULT_SETTINGS });
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS }).catch(console.error);
  },

  loadSettings: async () => {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        set({
          settings: deepMergeSettings(DEFAULT_SETTINGS, result.settings),
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));

function deepMergeSettings(
  target: any,
  source: any
): ExtensionSettings {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      output[key] = deepMergeSettings(
        target[key],
        source[key]
      );
    } else {
      output[key] = source[key];
    }
  }
  return output as unknown as ExtensionSettings;
}

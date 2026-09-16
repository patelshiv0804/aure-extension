// ──────────────────────────────────────────────────────────────
// Theme Store — Global, universal cross-view synchronization
// Synchronizes Sidepanel ⇄ Popup ⇄ Content Scripts ⇄ Settings
// ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import {
  Theme,
  ThemePreference,
  THEME_STORAGE_KEY,
  resolveTheme,
  getSystemTheme,
  D,
  L,
} from '@/theme/tokens';
import { useSettingsStore } from './settings.store';

interface ThemeStoreState {
  preference: ThemePreference;
  resolvedTheme: Theme;
  isDark: boolean;
  isLoaded: boolean;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

function getStoredLocalPreference(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch {}
  return null;
}

function applyDomTheme(resolved: Theme) {
  if (typeof document === 'undefined') return;

  const isExtensionPage = typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:';
  if (isExtensionPage) {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle('light', resolved === 'light');
    root.style.colorScheme = resolved;
  }

  // Content script container support
  const peApp = document.getElementById('pe-app');
  if (peApp) {
    peApp.classList.toggle('dark', resolved === 'dark');
    peApp.classList.toggle('light', resolved === 'light');
  }
}

// Initial synchronous resolution from localStorage
const initialLocalPref = getStoredLocalPreference() || 'system';
const initialResolved = resolveTheme(initialLocalPref);
applyDomTheme(initialResolved);

let isInitialized = false;

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  preference: initialLocalPref,
  resolvedTheme: initialResolved,
  isDark: initialResolved === 'dark',
  isLoaded: false,

  setPreference: (newPref: ThemePreference) => {
    const resolved = resolveTheme(newPref);
    set({
      preference: newPref,
      resolvedTheme: resolved,
      isDark: resolved === 'dark',
    });

    applyDomTheme(resolved);

    // 1. Persist to localStorage for immediate synchronous reads
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, newPref);
      } catch {}
    }

    // 2. Persist to chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: newPref }).catch(() => {});
    }

    // 3. Update settings store
    useSettingsStore.getState().updateSettings({
      ui: {
        ...useSettingsStore.getState().settings.ui,
        theme: newPref,
      },
    });

    // 4. Broadcast runtime message to all extension pages (Sidepanel ⇄ Popup)
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime
        .sendMessage({
          type: 'AURE_THEME_CHANGED',
          payload: { preference: newPref, resolvedTheme: resolved },
        })
        .catch(() => {});
    }

    // 5. Broadcast to all active tabs (for content scripts on AI platforms)
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'AURE_THEME_CHANGED',
                payload: { preference: newPref, resolvedTheme: resolved },
              })
              .catch(() => {});
          }
        });
      });
    }
  },

  toggleTheme: () => {
    const current = get().resolvedTheme;
    const next: ThemePreference = current === 'dark' ? 'light' : 'dark';
    get().setPreference(next);
  },

  initTheme: () => {
    if (isInitialized) return;
    isInitialized = true;

    // 1. Initial read from chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([THEME_STORAGE_KEY, 'settings'], (res) => {
        const storedPref = (res[THEME_STORAGE_KEY] || res['settings']?.ui?.theme) as
          | ThemePreference
          | undefined;

        if (storedPref && (storedPref === 'light' || storedPref === 'dark' || storedPref === 'system')) {
          const resolved = resolveTheme(storedPref);
          set({
            preference: storedPref,
            resolvedTheme: resolved,
            isDark: resolved === 'dark',
            isLoaded: true,
          });
          applyDomTheme(resolved);
          try {
            window.localStorage.setItem(THEME_STORAGE_KEY, storedPref);
          } catch {}
        } else {
          set({ isLoaded: true });
        }
      });

      // 2. Listen to chrome.storage.onChanged (cross-context updates)
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;

        const newPref = (changes[THEME_STORAGE_KEY]?.newValue ||
          changes['settings']?.newValue?.ui?.theme) as ThemePreference | undefined;

        if (newPref && (newPref === 'light' || newPref === 'dark' || newPref === 'system')) {
          const currentPref = get().preference;
          if (newPref !== currentPref) {
            const resolved = resolveTheme(newPref);
            set({
              preference: newPref,
              resolvedTheme: resolved,
              isDark: resolved === 'dark',
            });
            applyDomTheme(resolved);
            try {
              window.localStorage.setItem(THEME_STORAGE_KEY, newPref);
            } catch {}
          }
        }
      });
    } else {
      set({ isLoaded: true });
    }

    // 3. Listen to runtime messages for immediate zero-delay broadcast
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === 'AURE_THEME_CHANGED' && message.payload?.preference) {
          const newPref = message.payload.preference as ThemePreference;
          if (newPref === 'light' || newPref === 'dark' || newPref === 'system') {
            const currentPref = get().preference;
            if (newPref !== currentPref) {
              const resolved = message.payload.resolvedTheme || resolveTheme(newPref);
              set({
                preference: newPref,
                resolvedTheme: resolved,
                isDark: resolved === 'dark',
              });
              applyDomTheme(resolved);
              try {
                window.localStorage.setItem(THEME_STORAGE_KEY, newPref);
              } catch {}
            }
          }
        }
      });
    }

    // 4. Listen to OS system theme changes when preference === 'system'
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        if (get().preference === 'system') {
          const sys = getSystemTheme();
          set({
            resolvedTheme: sys,
            isDark: sys === 'dark',
          });
          applyDomTheme(sys);
        }
      };

      if (mql.addEventListener) {
        mql.addEventListener('change', handleMediaChange);
      } else {
        mql.addListener(handleMediaChange);
      }
    }
  },
}));

// Eagerly initialize theme listener on module import
if (typeof window !== 'undefined') {
  useThemeStore.getState().initTheme();
}

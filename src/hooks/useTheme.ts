// ──────────────────────────────────────────────────────────────
// useTheme — Hook for theme management
// ──────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings.store';

export function useTheme() {
  const theme = useSettingsStore((s) => s.settings.ui.theme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);

      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches);
      };
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
      return () => {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', listener);
      };
    }

    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return { theme, isDark: theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) };
}
